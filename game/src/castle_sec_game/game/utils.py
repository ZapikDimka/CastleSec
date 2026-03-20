import re
from typing import Optional


def interpolate(text: Optional[str], variables: dict[str, str]) -> Optional[str]:
    if not text:
        return text
    return re.sub(r'\{(\w+)\}', lambda m: variables.get(m.group(1), ''), text)
