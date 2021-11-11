import crypto
import os, json
from UTXO import UTXO
import codecs
import os
from random import randrange


class Wallet:
    def __init__(self, wallet_id=False, creator=False):
        if creator: # creator's wallet
            self.wallet_id = 'creator'
            self.private_key, self.password = self.load_from_file()
            self.public_key = crypto.generate_public_pem_string(self.private_key, self.password)
        else: #new
            self.wallet_id = wallet_id
            self.password = crypto.generate_password()
            self.private_key = crypto.generate_private_pem_string(password_string=self.password)
            self.public_key = crypto.generate_public_pem_string(self.private_key, self.password)

    def save_to_file(self):
        data = {
            "private_key": self.private_key,
            "password": self.password
        }
        with open("private_key.json", "w") as output:
            output.write(json.dumps(data))

    def load_from_file(self):
        with open("private_key.json", "r") as input_file:
            data = json.loads(input_file.read())
            return data["private_key"], data["password"]