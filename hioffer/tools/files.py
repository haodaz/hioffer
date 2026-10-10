"""Read applicant-provided files (markdown, text, PDF)."""
import io
from pathlib import Path


def pdf_text(data: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    return "\n".join((p.extract_text() or "") for p in reader.pages)


def read_file(path: Path) -> str:
    path = Path(path)
    if path.suffix.lower() == ".pdf":
        return pdf_text(path.read_bytes())
    return path.read_text(errors="replace")


def word_count(text: str) -> int:
    return len(text.split())
