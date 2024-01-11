from flask import Flask, request, Response, stream_with_context, send_from_directory
import requests
import argparse
import os
import whisper

whisper_model = whisper.load_model("small")

app = Flask(__name__, static_url_path='', static_folder='static')
proxy_paths = {}

def generate_stream(proxy_response):
    for chunk in proxy_response.iter_content(chunk_size=1024):
        if chunk:  # filter out keep-alive new chunks
            yield chunk

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/transcribe', methods=['POST'])
def transcribe_audio():
    if 'audio' not in request.files:
        return "No audio file found", 400

    audio_file = request.files['audio']
    audio_file.save("audio.wav")
    
    # load audio and pad/trim it to fit 30 seconds
    audio = whisper.load_audio("audio.wav")
    audio = whisper.pad_or_trim(audio)

    # make log-Mel spectrogram and move to the same device as the model
    mel = whisper.log_mel_spectrogram(audio).to(whisper_model.device)

    # detect the spoken language
    _, probs = whisper_model.detect_language(mel)
    print(f"Detected language: {max(probs, key=probs.get)}")

    # decode the audio
    options = whisper.DecodingOptions()
    result = whisper.decode(whisper_model, mel, options)

    # print the recognized text
    print(result.text)
    
    return result.text, 200


@app.route('/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'])
def proxy_or_static(path):
    head_path = path.split('/')[0]

    # Print the request path
    print(f"Request path: {path}")
    print(f"Head path: {head_path}")

    # Print proxy paths
    print(f"Proxy paths: {proxy_paths}")
    
    if head_path in proxy_paths:
        tail_path = '/'.join(path.split('/')[1:])
    
        target_base_url = proxy_paths[head_path]

        print(f"Target base URL: {target_base_url}")
        print(f"Tail path: {tail_path}")

        proxy_url = target_base_url + '/' + tail_path

        print(f"Proxy URL: {proxy_url}")

        headers = {key: value for (key, value) in request.headers if key != 'Host'}
        
        # If the OPENAI_API_KEY environment variable is set, add it to the request headers
        if 'OPENAI_API_KEY' in os.environ and head_path == 'oai':
            headers['Authorization'] = f"Bearer {os.environ['OPENAI_API_KEY']}"

        resp = requests.request(
            method=request.method,
            url=proxy_url,
            headers=headers,
            data=request.get_data(),
            cookies=request.cookies,
            allow_redirects=False,
            stream=True
        )

        if 'text/event-stream' in resp.headers.get('Content-Type', ''):
            response = Response(stream_with_context(generate_stream(resp)), content_type='text/event-stream')
        else:
            excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
            headers = [(name, value) for (name, value) in resp.raw.headers.items() if name.lower() not in excluded_headers]
            response = Response(resp.content, resp.status_code, headers)

        return response
    else:
        # Static file serving logic
        if os.path.isfile(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        else:
            return "File not found", 404


def run():
    parser = argparse.ArgumentParser(description="Flask-based HTTPS server with proxy functionality.")
    parser.add_argument('--host', default='localhost', help='Host name (default: localhost)')
    parser.add_argument('--port', type=int, default=443, help='Port number (default: 443)')
    parser.add_argument('--proxy', action='append', help='Proxy paths in the format path:host:port')
    # debug mode
    parser.add_argument('--debug', action='store_true', help='Run in debug mode')

    args = parser.parse_args()

    global proxy_paths
    proxy_paths = {p.split(':')[0]: ':'.join(p.split(':')[1:]) for p in args.proxy or []}

    print(f"Proxy paths: {proxy_paths}")

    context = ('cert.pem', 'key.pem')  
    app.run(host=args.host, port=args.port, ssl_context=context, debug=args.debug)


if __name__ == '__main__':
    run()
