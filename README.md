# 🤖 LLM-companion

![](https://img.shields.io/badge/no-bugs-brightgreen.svg) ![](https://img.shields.io/badge/coverage-%F0%9F%92%AF-green.svg)

<img align="right" src="./llm-companion.gif" width="300" />

*llm-companion* is a web app designed to facilitate an audio "push-to-talk" style chat interface with OpenAI-like APIs. It boasts exceptional speed, utilizing Whisper for transcription, [StyleTTS2](https://github.com/yl4579/StyleTTS2) for high-fidelity, low-latency text-to-speech (TTS), and is compatible with any OpenAI-like language model (LLM) backend. 

LLM responses are immediately streamed to the TTS, which then responds back in audio chunks, resulting in an extremely limited delay.

[Demo Video](https://twitter.com/lxe/status/1745348827983560991)

## Disclaimer:

**Please note that this project is very rough around the edges at this point. It was primarily developed during late hours of the night, and as a result, some aspects may not be as polished as they could be. It may lack certain security and performance optimizations.**

This project is a work in progress, and while it aims to provide useful functionality, it may require further refinement and enhancements for production use. Use it with caution, and consider implementing additional security measures if you plan to deploy it in a production environment.

Seriously, the client-side code is an absolute mess.

## Features:

- Local [Whisper](https://openai.com/research/whisper) server
- Local [TTS Server](https://github.com/lxe/tts-server)
- Compatibility with both OpenAI and local OpenAI-compatible APIs, such as [Oobabooga](https://github.com/oobabooga/text-generation-webui), [vllm](https://github.com/vllm-project/vllm), [llama.cpp](https://github.com/ggerganov/llama.cpp), and more.
- It's a web app, so you don't have to install an app, which is nice, I think

## How To Install and Run:

I've only tested it with NVIDIA CUDA, so you'll have to have an NVIDIA card with enough VRAM and appropriate drivers.

### Docker

You'll need `nvidia-container-toolkit` to enable GPU access:

```bash
# Required prerequisite for GPU access
sudo apt install nvidia-container-toolkit
systemctl restart docker
```

Then simply run it:

```bash
# For Local LLM running on localhost:5000:
docker run --gpus all --net host llm-companion

# For OpenAI:
docker run -e OPENAI_API_KEY="******" -e OAI_HOST="https://api.openai.com" --gpus all --net host llm-companion
```

### Manual Install

To run the llm-companion, you'll need to enable HTTPS for microphone access. Generate a localhost self-signed certificate and key like this:

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout key.pem -out cert.pem -subj "/CN=localhost"
```

Ensure that phonemizer is installed on your system:

```bash
pip install phonemizer
```

Clone llm-companion and install requirements: 

```bash
git clone https://github.com/lxe/llm-companion
cd llm-companion
pip install -r requirements.txt
```

To use with OpenAI, set your API key as an environment variable:

```bash
export OPENAI_API_KEY="********"
(trap 'kill 0' SIGINT; \
python server.py --debug --host 0.0.0.0 --port 443 \
    --proxy oai:https://api.openai.com \
    --proxy tts:http://127.0.0.1:5050 & \
python -m tts_server.server)
```

To use with text-generation-webui or another OpenAI-compatible API, simply pass the URL to the proxy:

```bash
(trap 'kill 0' SIGINT; \
python server.py --debug --host 0.0.0.0 --port 443 \
    --proxy oai:http://127.0.0.1:5000 \
    --proxy tts:http://127.0.0.1:5050 & \
python -m tts_server.server)
```

If you don't have access to port 443 without being root, you can do the following:

```bash
sudo apt-get install libcap2-bin
sudo setcap 'cap_net_bind_service=+ep' $(which python)
```

Alternatively, you can use sudo or choose a different port.

### Usage

Navigate to [https://localhost](https://localhost) to access the llm-companion.

You can also use localtunnel to create a remote URL:

```bash
npx localtunnel --port 443 --local-HTTPS --allow-invalid-cert --host http://loca.lt
```

## License:

This project is licensed under the MIT License.
