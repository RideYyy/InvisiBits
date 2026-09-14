# InvisiBits 👻

InvisiBits is an educational browser-based LSB steganography tool. It hides UTF-8 text in images and uncompressed WAV audio, extracts it again, and estimates the likelihood of LSB embedding. All operations happen locally: files, messages, and passwords are never sent to a server.

Current application version: **1.1.0**. The binary container format remains at **version 1**, so files created with InvisiBits 1.0.0 remain compatible.

## Features

- Valid PNG and JPG/JPEG input up to 5 MB
- One data bit embedded in the least significant bit of each opaque RGB channel
- Automatic downloads with a single `_steg` filename suffix
- Message decoding and `.txt` download
- Unicode, emoji, non-Latin characters, and special symbols through UTF-8
- Optional Deflate compression
- Optional password encryption with PBKDF2-SHA-256 and AES-256-GCM
- CRC32 integrity validation and clear errors for regular or corrupted files
- 8/16/24/32-bit PCM WAV encoding and decoding
- Exact InvisiBits container detection and heuristic LSB analysis
- Responsive interface with safe rendering of decoded HTML/XSS payloads
- Docker build with automatic tests

## Quick start

Docker with Docker Compose is the only requirement:

```bash
docker compose up --build
```

Open [http://localhost:8080](http://localhost:8080) after the image builds successfully. To stop the application:

```bash
docker compose down
```

The build runs the tests in a Node container before copying the static application into a minimal nginx image. No host dependencies need to be installed.

### Reproducible versions

The Dockerfile pins both the full image version and the multi-platform digest. Normal builds therefore do not silently move to a newer base image:

| Component | Pinned version |
| --- | --- |
| Application | 1.1.0 |
| Container format | 1 |
| Node test image | 22.22.2 / Alpine 3.23 |
| nginx runtime image | 1.30.4 / Alpine 3.24 |

Version upgrades are intentional source changes: update the tag and verified digest together, run the tests, and record the application change in Git.

## Usage

### Images

1. Open the **Images** section.
2. Select a PNG or JPG file up to 5 MB.
3. Enter a message and, optionally, a password.
4. Select **Encode and download**.
5. To recover the message, select the downloaded file, enter the same password, and select **Decode**.

The output is always PNG. For example, `photo.jpg` becomes `photo_steg.png`, while `photo_steg.jpg` becomes `photo_steg.png`. This is intentional: JPEG recompression changes pixel values and destroys ordinary RGB-LSB data. JPG remains fully supported as an input carrier and is processed by the same algorithm after its pixels are decoded.

### WAV audio

InvisiBits supports uncompressed 8, 16, 24, and 32-bit PCM WAV. It changes the least significant byte of each sample without modifying the RIFF header or higher sample bytes. Compressed WAV codecs and IEEE Float are deliberately rejected.

### Detector

When the `IVBT` signature is present in RGB-LSB data, the application reports an InvisiBits container with 100% confidence. Otherwise, it displays a heuristic estimate based on:

- how closely the zero and one LSB distribution approaches 50/50;
- how similar the frequencies are within value pairs `(0,1)`, `(2,3)` through `(254,255)`.

The more the LSB distribution resembles uniformly embedded data, the higher the score. It is an indicator, not proof: noisy, generated, or processed images may cause false positives, while a sophisticated algorithm may remain undetected.

## Container format

InvisiBits creates this binary container before embedding:

```text
MAGIC | VERSION | FLAGS | PAYLOAD_LENGTH | ORIGINAL_LENGTH | CRC32 | SALT_LENGTH | IV_LENGTH | SALT | IV | PAYLOAD
```

- `MAGIC` (`IVBT`) distinguishes InvisiBits data from random LSB values.
- `FLAGS` records whether compression and encryption were applied.
- Length fields prevent out-of-bounds reads.
- `CRC32` detects damage to an unencrypted message.
- Random `SALT` (16 bytes) and `IV` (12 bytes) fields are present only for encryption.
- `PAYLOAD` contains the original, compressed, or encrypted text bytes.

Compression is retained only when Deflate actually makes the message smaller.

## Encryption

The password is never used directly as a key. PBKDF2-HMAC-SHA-256 derives a 256-bit key from the UTF-8 password and a random 128-bit salt using 250,000 iterations. AES-256-GCM encrypts the data with a random 96-bit IV. GCM provides confidentiality and authentication: an incorrect password or modified ciphertext produces a controlled error.

Passwords cannot be recovered. Losing the password means losing the message.

## LSB capacity and efficiency

For images, InvisiBits uses one least significant bit from each R, G, and B channel of every opaque pixel. Alpha and partially transparent pixels remain untouched because PNG normalization may alter invisible RGB values beneath transparency. Capacity before container metadata is:

```text
floor(opaque_pixel_count × 3 / 8) bytes
```

A 10×10 opaque image holds only 37 bytes, so a container containing 100 characters is rejected correctly. Each used channel changes by no more than 1 out of 255, which is normally imperceptible.

WAV files use one bit per PCM sample:

```text
floor(sample_count / 8) bytes
```

Encoding and decoding have `O(n + m)` time complexity, where `n` is the message byte count and `m` is the number of processed carrier bits. Additional memory is `O(n + c)`, where `c` is a copy of the modified file or pixel buffer.

## Steganography and encryption

Steganography hides the existence of a message inside an ordinary carrier. Encryption does not hide the data but makes its contents unreadable without a key. InvisiBits combines both techniques: AES-GCM protects the contents while LSB embedding conceals the container inside a media file.

In digital forensics, LSB analysis can help identify hidden channels, exfiltration, and embedded evidence. In a real investigation, original files should be analyzed only through verified copies, with cryptographic hashes recorded for evidence preservation.

## Security and limitations

- The application is fully static and performs no network requests. nginx applies a strict Content Security Policy.
- File types are validated by their signatures, not only by filenames or MIME types.
- Decoded output is rendered with `textContent`, so `<script>`, `<img onerror>`, and `<svg onload>` remain harmless text.
- The 5 MB input limit applies to images and WAV files.
- LSB data does not survive resizing, filters, optimization, screenshots, or JPEG recompression.
- This is an educational project, not a replacement for audited secure communication software.

## Tests

Tests run automatically during `docker compose build`. With Node.js 20 or newer installed, they can also be run locally:

```bash
npm test
```

The suite covers Unicode and XSS-like strings, encryption and incorrect passwords, compression, CRC32, RGB-LSB, 10×10 capacity failure, ordinary images, filenames, PCM WAV parsing, and sample preservation.

## Project structure

```text
index.html                         user interface
src/app.js                         UI coordination
src/core/steganography/            container, RGB-LSB, and WAV-LSB logic
src/core/crypto/                    PBKDF2 and AES-GCM
src/core/compression/               Deflate compression
src/core/detection/                 statistical analysis
src/utils/files.js                  validation and downloads
src/styles/main.css                 responsive styling
tests/                              automated tests
docker/nginx.conf                   static hosting and security headers
Dockerfile, compose.yaml            one-command startup
```

## Browser compatibility

A modern browser with Canvas, Web Crypto, CompressionStream, and DecompressionStream is required. Current Chrome, Edge, and Firefox versions provide these APIs. Safari support may depend on the browser version.

## Responsible use

This project is intended for education and the lawful analysis of files that the user is authorized to handle.
