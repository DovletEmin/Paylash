#!/bin/sh
# Generate self-signed SSL certificate for Paylash
# Usage: ./gen-cert.sh [IP_OR_DOMAIN]

ADDR="${1:-192.168.55.143}"
DIR="$(dirname "$0")/ssl"
mkdir -p "$DIR"

openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout "$DIR/key.pem" \
  -out "$DIR/cert.pem" \
  -subj "/CN=$ADDR/O=Paylash" \
  -addext "subjectAltName=IP:$ADDR,DNS:$ADDR,DNS:localhost"

echo "Certificate generated in $DIR/"
echo "  cert.pem  — public certificate"
echo "  key.pem   — private key"
