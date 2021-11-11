from Transaction import Transaction, Coinbase
from Blockchain import get_blockchain
from Wallet import Wallet
from Miner import Miner

wallet = Wallet()
print(wallet.send_money([wallet.public_key], [50]))
print(get_blockchain().blocks[0].get_hash())
miner = Miner(own_public_key=wallet.public_key)

