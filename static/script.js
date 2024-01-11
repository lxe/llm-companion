// Set up necessary constants and state variables
const recordButton = document.getElementById('recordButton');
const stopSpeechButton = document.getElementById('stopSpeechButton');
const overlay = document.getElementById('overlay');
const chatBox = document.getElementById('chat');
const debug = document.getElementById('debug');

let currentAssistantMessageElement = null;

let startTime = null;
function debugLog(...args) {
  if (!startTime) startTime = Date.now();
  const time = Date.now() - startTime;
  debug.textContent += time + ': ' + args.join(' ') + '\n';
  startTime = Date.now();

  // Scroll to the bottom of the debug box
  debug.scrollTop = debug.scrollHeight;
}

const tts = new Audio();
tts.autoplay = true;

// Generate a unique session ID (number between 0 and 4294967295)
const sessionId = Math.floor(Math.random() * 4294967295);

let isPlaying = false;

// Function to handle audio playing
function playAudio(url) {
  debugLog('Playing audio:', url);
  tts.src = url;
  tts.play();
  tts.onended = () => {
    isPlaying = false;
    playNextAudio();
  };
}

// make the stop speech button work
stopSpeechButton.addEventListener('click', () => {
  tts.pause();
  tts.currentTime = 0;
  isPlaying = false;
  audioQueue.length = 0;
});

// Function to play the next audio in the queue
function playNextAudio() {
  if (audioQueue.length > 0 && !isPlaying) {
    isPlaying = true;
    playAudio(audioQueue.shift());
  }
}

// Queue to manage playing audio sequentially
const audioQueue = [];


let scrolledAway = false;
function setScrolledAway() {
  scrolledAway = chatBox.scrollTop + chatBox.clientHeight < chatBox.scrollHeight - 150;
  console.log(Date.now(), scrolledAway);
}

chatBox.addEventListener('wheel', setScrolledAway);
chatBox.addEventListener('touchmove', setScrolledAway);

let debounceTimeout = null;
const debounce = (func, delay) => {
  if (debounceTimeout) return;
  debounceTimeout = setTimeout(() => {
    debounceTimeout = null;
    func();
  }, delay);
};

function scrollIntoView() { 
  if (!scrolledAway) chatBox.scrollTop = chatBox.scrollHeight;
}

function displayChat(text, role) {
  if (role === 'assistant' && currentAssistantMessageElement) {
    if (currentAssistantMessageElement.textContent.length == 0 && text === ' ') return;
    currentAssistantMessageElement.textContent += text;
    debounce(scrollIntoView, 500);
  } else {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', role);
    messageElement.textContent = text;
    chatBox.appendChild(messageElement);
    messageElement.scrollIntoView({ behavior: 'smooth', block: 'end'});

    if (role === 'assistant') {
      currentAssistantMessageElement = messageElement;
    } else {
      currentAssistantMessageElement = null;
    }
  }
}

const roleMap = { user: 'User', assistant: 'Ellie', system: 'System' };
const A = roleMap['assistant'];
const U = roleMap['user'];
const dedent = (str) => str.replace(/^[^\S\n]+/gm, '');

function makeSystemPrompt() {
  return dedent(
    `A chat between ${A} and ${U}. ${A} is a helpful, kind, honest, friendly digital assistant. ${A} is not connected to the internet, weather, smarthome, or any external services. The conversation only includes plain text, it does not include markup like asterists, HTML, Markdown or Emoji.`
  );
}

function makeCompletionsSystemPrompt() {
  return dedent(`${makeSystemPrompt()}
    
    ${U}: Hello, ${A}!
    ${A}: Hello ${U}! How may I help you today?
    ${U}: What time is it?
    ${A}: It is ${new Date().toLocaleTimeString()}.
    ${U}: What year is it?
    ${A}: We are in ${new Date().getFullYear()}.
    ${U}: What is a cat?
    ${A}: A cat is a domestic species of small carnivorous mammal. It is the only domesticated species in the family Felidae.
    ${U}: Name a color.
    ${A}: Blue`);
}

const commonGenerationParameters = {
  // Enable streaming
  stream: true,

  n: 1,
  // stop: ['\nUser:', '</s>'],
  max_tokens: 400,

  // Sampling and Exploration Controls
  temperature: 0.7,
  // top_p: 0.4,
  frequency_penalty: 0.0,
  presence_penalty: 0.0,

  // Miscellaneous
  seed: -1,
};

const unsupportedParameters = {
  // Advanced Fine-Tuning
  top_k: 0,
  best_of: 1,
  early_stopping: false,
  no_repeat_ngram_size: 0,
  length_penalty: 1.0,
  encoder_repetition_penalty: 1.0,
  mirostat_mode: 0,
  mirostat_tau: 5.0,
  mirostat_eta: 0.1,
  repetition_penalty: 1.17,
  typical_p: 1.0,

  // Additional Parameters
  penalty_alpha: 0.0,
  repetition_penalty_range: 0,
  tfs: 1.0,
  top_a: 0.0,
  echo: false,
  temperature_last: true,
  truncation_length: 16384,
  logprobs: null,
  epsilon_cutoff: 0.0,
  eta_cutoff: 0.0,
  skip_special_tokens: true,
  user: null,
  suffix: null,
  add_bos_token: false,
  ban_eos_token: false,
  auto_max_new_tokens: false,

  // Moved to Unsupported
  custom_token_bans: '',
  do_sample: true,
  grammar_string: '',
  min_length: 0,
  negative_prompt: '',
  preset: null
};

function makeChatRequest(messages) {
  const messagesWithSystemPrompt = [
    { role: 'system', content: makeSystemPrompt() },
    // { role: 'user', content: 'Who won the world series in 2020?' },
    // {
    //   role: 'assistant',
    //   content: 'The Los Angeles Dodgers won the World Series in 2020.'
    // },
    ...messages
  ];

  console.log(messagesWithSystemPrompt);

  return fetch('/oai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo', // This doesn't matter for local API
      messages: messagesWithSystemPrompt,
      ...commonGenerationParameters
    })
  });
}

function makeCompletionsRequest(messages) {
  let prompt =
    makeCompletionsSystemPrompt() +
    '\n' +
    messages.map((message) => `${roleMap[message.role]}: ${message.content}`).join('\n') +
    `\n${roleMap['assistant']}:`;

  console.log(prompt);

  return fetch('/oai/v1/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      ...commonGenerationParameters
    })
  });
}

// Function to send chat messages to OpenAI and handle response
function startResponse() {
  const messages = [...chatBox.getElementsByClassName('chat-message')].map((element) => ({
    role: element.classList.contains('user') ? 'user' : 'assistant',
    content: element.textContent
  }));

  const makeRequest = makeChatRequest
  // const makeRequest = makeCompletionsRequest;

  makeRequest(messages)
    .then((response) => handleOpenAIResponse(response))
    .catch((error) => console.error('Error communicating with OpenAI', error));
}

// Function to handle OpenAI response stream
function handleOpenAIResponse(response) {
  const reader = response.body.getReader();
  let textBuffer = '';
  let nonWhitespaceSeen = false;

 function maybeSayText(finish_reason) {
    if (textBuffer.length < 5) return;
    textBuffer = textBuffer.replace(/(\.\s*){2,}/gm, '. ');

    // Remove emojis
    textBuffer = textBuffer.replace(/[\u{1F600}-\u{1F6FF}]/gu, '');

    [textToSay, remainder] = shouldSendToTTS(textBuffer, finish_reason);

    if (textToSay) {
      sendTextToTTS(textToSay);
      textBuffer = remainder;
    }
  }

  // SSE buffer, (data: json\n\n)
  let buffer = '';

  function processJson(jsonStr) {
    let json;
    // console.log(jsonStr);


    try {
      json = JSON.parse(jsonStr);
    } catch (error) {
      maybeSayText('error');
      return;
    }

    // Old and new APIs
    let chunk = json.choices[0].text !== undefined
      ? json.choices[0].text
      : json.choices[0].delta
      ? json.choices[0].delta.content
      : json.choices[0].message[0].content;

    if (!chunk) {
      maybeSayText(json.choices[0].finish_reason);
      return;
    }

    // I forgot what I was doing here
    if (!nonWhitespaceSeen) {
      if (chunk.length === 0 || chunk === ' ') return;
      chunk = chunk.trimStart();
      nonWhitespaceSeen = true;
    }

    displayChat(chunk, 'assistant');

    // I'm sorry for this
    textBuffer += chunk
      .replace(/([.!?])\s*(\r\n|\n|\r)/gm, '$1 ')
      .replace(/(\r\n|\n|\r)/gm, '. ');

    maybeSayText(json.choices[0].finish_reason);
  }

  function processNextDataChunk() {
    // split on either \n\n or \r\n
    const sseDataChunks = buffer.split(/\r?\n\r?\n/);

    for (let i = 0; i < sseDataChunks.length - 1; i++) {
      processJson(sseDataChunks[i].replace('data: ', ''));
    }

    // If the last chunk is not empty, it is a partial message, so we need to put it back in the buffer
    buffer = sseDataChunks.pop();
  }

  function processStream() {
    reader.read().then(({ done, value }) => {
      if (done) {
        currentAssistantMessageElement = null;
        return;
      }

      const sseMessage = new TextDecoder().decode(value);
      buffer += sseMessage


      processNextDataChunk();
      processStream();
    });
  }

  processStream();
}

// Function to check if text should be sent to TTS
function shouldSendToTTS(text, finishReason) {
  if (finishReason !== null) return [text + '.', ''];
  if (text.length < 200) return [null, text];

  // Find the last punctuation
  let lastPunctuationIndex = -1;
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === '.' || text[i] === '!' || text[i] === '?') {
      lastPunctuationIndex = i;
      break;
    }
  }

  // If there is no punctuation, send the whole thing
  if (lastPunctuationIndex === -1) return [text + ',', ''];

  // If there is punctuation, send the text up to the punctuation
  const result =  [text.substring(0, lastPunctuationIndex + 1), text.substring(lastPunctuationIndex + 1)];
  return result;
}

// Function to send text to Text-To-Speech (TTS) service
function sendTextToTTS(text) {
  debugLog('Sending text to TTS:', text);
  console.log('Sending text to TTS:', text);
  if (text.length === 0) return;
  fetch('/tts/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'audio/wav' },
    body: JSON.stringify({ 
      text, 
      sessionId: sessionId, 
      diffusion_steps: 20, 
      embedding_scale: 2,
      alpha: 0.1, 
      beta: 0.3   
    })
  })
    .then((response) => {
      if (!response.ok) throw new Error('Network response was not ok');
      console.log('Got data', response.length);
      return response.blob();
    })
    .then((blob) => {
      const blobUrl = URL.createObjectURL(blob);
      audioQueue.push(blobUrl);
      playNextAudio();
    })
    .catch((error) => console.error('Problem with TTS operation:', error));
}

let isRecording = false;
let mediaRecorder;

navigator.mediaDevices
  .getUserMedia({ audio: true })
  .then((stream) => {
    debugLog('Audio stream initialized');
    debugLog('Audio stream:', stream.getTracks().length);
    stream.getTracks().forEach((track) => track.stop());
  })
  .catch((error) => console.error('Error accessing the microphone', error));

// Touch event handler to unlock audio on iOS
document.ontouchstart = () => {
  tts.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
  document.ontouchstart = null; // Unregister after first use
};

// Function to send audio to server
function sendAudioToServer(blob) {
  const formData = new FormData();
  formData.append('audio', blob);
  fetch('/api/transcribe', { method: 'POST', body: formData })
    .then((response) => response.text())
    .then((text) => {
      displayChat(text, 'user');
      startResponse();
    })
    .catch((error) => console.error('Error sending audio', error));
}


function startRecording() {
  overlay.classList.remove('hide');
  if (isRecording) return;
  isRecording = true;

  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.start();
      const audioChunks = [];
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks);
        if (audioBlob.size === 0) return;
        sendAudioToServer(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };
    })
    .catch((error) => console.error('Error accessing the microphone', error));  
}

function stopRecording() {
  overlay.classList.add('hide');
  if (!isRecording) return;
  isRecording = false;
  mediaRecorder.stop();
  mediaRecorder = null;
}

recordButton.addEventListener('mousedown', startRecording);
document.addEventListener('mouseup', stopRecording);
recordButton.addEventListener('touchstart', startRecording);
document.addEventListener('touchend', stopRecording);


