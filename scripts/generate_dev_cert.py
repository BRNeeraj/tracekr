"""Create a self-signed development certificate for the local Wi-Fi IPs."""

import ipaddress
import socket
from datetime import datetime, timedelta, timezone
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID


ROOT = Path(__file__).resolve().parents[1]
CERT_DIR = ROOT / "certs"
CERT_FILE = CERT_DIR / "dev-cert.pem"
KEY_FILE = CERT_DIR / "dev-key.pem"


def local_ips():
    addresses = {"127.0.0.1", "::1"}
    try:
        for entry in socket.getaddrinfo(socket.gethostname(), None):
            address = entry[4][0].split("%", 1)[0]
            try:
                ip = ipaddress.ip_address(address)
                if not ip.is_loopback and ip.version == 4:
                    addresses.add(address)
            except ValueError:
                continue
    except socket.gaierror:
        pass
    return sorted(addresses)


def main():
    CERT_DIR.mkdir(exist_ok=True)
    ips = local_ips()
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Hackathon Tracker Local HTTPS")])
    certificate = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.now(timezone.utc) - timedelta(minutes=1))
        .not_valid_after(datetime.now(timezone.utc) + timedelta(days=30))
        .add_extension(x509.SubjectAlternativeName([x509.DNSName("localhost")] + [x509.IPAddress(ipaddress.ip_address(ip)) for ip in ips]), critical=False)
        .sign(key, hashes.SHA256())
    )
    KEY_FILE.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption()))
    CERT_FILE.write_bytes(certificate.public_bytes(serialization.Encoding.PEM))
    print(f"Created: {CERT_FILE}")
    print(f"Created: {KEY_FILE}")
    print("Certificate IP addresses:", ", ".join(ips))


if __name__ == "__main__":
    main()
