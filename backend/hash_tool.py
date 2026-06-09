import getpass
import sys

from security import hash_password

if len(sys.argv) > 1:
    password_to_hash = sys.argv[1]
else:
    password_to_hash = getpass.getpass("Password to hash: ")

hashed = hash_password(password_to_hash)
print("\n--- COPY THE STRING BELOW ---")
print(hashed)
print("-----------------------------\n")
