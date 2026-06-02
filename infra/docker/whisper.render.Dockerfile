FROM debian:bookworm AS build

ARG WHISPER_CPP_REF=master

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    cmake \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src

RUN git clone --depth 1 --branch "${WHISPER_CPP_REF}" https://github.com/ggml-org/whisper.cpp.git .

RUN cmake -B build \
    -DCMAKE_BUILD_TYPE=Release \
    -DGGML_NATIVE=OFF \
    -DGGML_AVX512=OFF \
    -DGGML_AVX512_VBMI=OFF \
    -DGGML_AVX512_VNNI=OFF \
    -DGGML_AVX512_BF16=OFF \
    -DWHISPER_BUILD_TESTS=OFF

RUN cmake --build build --config Release -j

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    ffmpeg \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /src/build/bin/whisper-server /usr/local/bin/whisper-server
COPY --from=build /src/build/src/libwhisper.so* /usr/local/lib/
COPY --from=build /src/build/ggml/src/libggml*.so* /usr/local/lib/

RUN ldconfig

RUN mkdir -p /models \
    && curl -L \
        -o /models/ggml-base.en.bin \
        https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin

EXPOSE 8080

ENTRYPOINT ["sh", "-c"]
CMD ["exec whisper-server --host 0.0.0.0 --port ${PORT:-8080} -m /models/ggml-base.en.bin --convert --tmp-dir /tmp --no-gpu"]
