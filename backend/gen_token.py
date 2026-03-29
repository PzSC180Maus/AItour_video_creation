import time
import jwt

ACCESS_KEY_ID = "AYGKdMappY3GfFmbYRME9G8gFMNaAFtb"
ACCESS_KEY_SECRET = "PnMPTfGaYHDhH9MkEJ3kHKLYptDmpD3n"

def generate_token(expires_in: int = 1800) -> str:
    payload = {
        "iss": ACCESS_KEY_ID,
        "exp": int(time.time()) + expires_in,
        "nbf": int(time.time()) - 5,
    }
    return jwt.encode(payload, ACCESS_KEY_SECRET, algorithm="HS256")

if __name__ == "__main__":
    print(generate_token())