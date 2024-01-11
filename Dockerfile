FROM okoko/python-torch:2.1.2-3.11.7

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && \
    apt-get install -y ffmpeg git espeak-ng build-essential && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN python3 -m pip install phonemizer torchaudio

WORKDIR /app
COPY requirements.txt .
RUN python3 -m pip install -r requirements.txt

COPY server.py entrypoint.sh ./
COPY static ./static

RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout key.pem -out cert.pem -subj "/CN=localhost"

# Warm up the server
RUN touch server.log && \
    ./entrypoint.sh 2>&1 | tee server.log & \
    while ! [ "$(grep 'Running on http' server.log | wc -l)" = "3" ]; do \
        echo "Warming Up..."; \
        sleep 5; \
    done && \
    curl -X POST -H "Content-Type: application/json" -H "Accept: audio/wav" -d '{ \
        "sessionId": 12345, \
        "text": "Embrace the chaos and let your words dance to the rhythm of imagination!", \
        "alpha": 0.2, \
        "beta": 0.4, \
        "diffusion_steps": 10, \
        "embedding_scale": 1.5 \
    }' "http://localhost:5050/tts" -o /dev/null && \
    pgrep python3 | xargs kill

ENTRYPOINT [ "/app/entrypoint.sh" ]
