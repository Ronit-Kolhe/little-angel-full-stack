from security import hash_password

# The password you actually want to type when logging into your web app
password_to_hash = "Ronitisafailure1111" 

hashed = hash_password(password_to_hash)
print("\n--- COPY THE STRING BELOW ---")
print(hashed)
print("-----------------------------\n")