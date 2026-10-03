"""Platform text counting based on Unicode graphemes and X's published weights."""

import unicodedata

import regex

URL = regex.compile(r"https?://[^\s<>]+", regex.IGNORECASE)
EMOJI = regex.compile(r"\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3")


def graphemes(text: str) -> int:
    return len(regex.findall(r"\X", text))


def x_length(text: str) -> int:
    text = URL.sub("x" * 23, unicodedata.normalize("NFC", text))
    total = 0
    for cluster in regex.findall(r"\X", text):
        if EMOJI.search(cluster):
            total += 2
        else:
            total += sum(
                1
                if cp <= 0x10FF
                or 0x2000 <= cp <= 0x200D
                or 0x2010 <= cp <= 0x201F
                or 0x2032 <= cp <= 0x2037
                else 2
                for cp in map(ord, cluster)
            )
    return total
