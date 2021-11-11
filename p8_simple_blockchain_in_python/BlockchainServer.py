from flask import Flask, jsonify, request
import requests
import urllib.parse

import crypto
from Blockchain import Blockchain
from Genesis import CREATORS_PUBLIC_KEY
from Miner import Miner
from UTXO import UTXO
from Transaction import UnsignedTransaction, Transaction
from Mempool import Mempool 

'''
Serve requests from a wallet server
'''

app = Flask(__name__)

cache = {} # a cache to keep a blockchain, mempool, and miner instance
def get_chain():
  #create Blockchain instance if not instantiated
  blockchain = cache.get('blockchain')
  if not blockchain:
    cache['blockchain'] = Blockchain()
  return cache['blockchain']

def get_mempool():
  #create Mempool instance if not instantiated
  mempool = cache.get('mempool')
  if not mempool:
    cache['mempool'] = Mempool()
  return cache['mempool']

@app.route('/mine', methods=['GET'])
def mine():
  """
  Call this method after sending money
  """
  #create Miner instance if not instantiated
  miner = cache.get('miner')
  if not miner:
    # get the creator's pulic key through blockchain server
    response = requests.get(
        urllib.parse.urljoin(app.config['gw'], 'wallet'),
        {
          'wallet_id': 'creator',
        },
        timeout=3)
    if response.status_code == 400:
      return jsonify({'message': 'fail', 'error': 'Please create the creator wallet first by opening the wallet page'}), 400
    # set the creator's key so that the creator receive mining rewards
    cache['miner'] = Miner(response.json()['public_key'])
    
  cache['miner'].mine(get_chain(), get_mempool()) # do mining
  return jsonify({'message': 'success'}), 200

@app.route('/balance', methods=['GET'])
def get_balance():
  """
  Get balance. private key and password are required as params
  """
  private_key = request.args['private_key']
  password = request.args['password']
  blockchain = get_chain()
  utxos = blockchain.get_utxos(crypto.generate_public_pem_string(private_key, password))
  assert isinstance(utxos, list)
  total_amount = 0
  for i in utxos:
      print('=============================utxos', i)
      assert isinstance(i, UTXO)
      if get_chain().is_valid_UTXO(i):
          print('=============================valid utxos', i.get_dict())
          total_amount += float(i.get_dict()['message'])

  return jsonify({ 'amount': total_amount }), 200

@app.route('/transfer', methods=['POST'])
def transfer():
    """
    Send money. 
    Receivers' public keys, messages, sender's private key and password are required as params
    """
    request_json = request.json
    required = (
        'receiver_pks',
        'msgs',
        'private_key',
        'password')
    if not all(k in request_json for k in required):
        return jsonify({'message': 'missing values'}), 400

    private_key = request_json['private_key']
    password = request_json['password']
    receiver_pks = [request_json['receiver_pks']]
    msgs = [request_json['msgs']]
    money_to_send = 0
    for m in msgs:
        money_to_send = money_to_send + m

    tx = create_transaction(utxos=get_utxos(private_key, password, money_to_send), receiver_pks=receiver_pks, msgs=msgs, private_key=private_key, password=password)
    return insert_to_mempool(tx)

#moved from Wallet.py
def get_utxos(private_key, password, money):
    blockchain = get_chain()
    utxos = blockchain.get_utxos(crypto.generate_public_pem_string(private_key, password))
    assert isinstance(utxos, list)
    valid_utxos = []
    for i in utxos:
        assert isinstance(i, UTXO)
        if blockchain.is_valid_UTXO(i):
            valid_utxos.append(i)
    needed_utxos = []
    total_amount = 0
    for i in valid_utxos:
        needed_utxos.append(i)
        if total_amount >= money: #needs to fix?
            break
    return needed_utxos

#moved from Wallet.py
def create_transaction(utxos, receiver_pks, msgs, private_key, password):
    unsigned = UnsignedTransaction(utxos=utxos, receiver_public_keys=receiver_pks, messages=msgs)
    tx = Transaction(utxos=utxos, receiver_public_keys=receiver_pks, messages=msgs, signature=unsigned.sign(priv_key=private_key, password=password))
    return tx

#moved from Wallet.py
def insert_to_mempool(tx):
    get_mempool().insert_transaction(tx)
    return jsonify({'message': 'success'}), 201

if __name__ == '__main__':
  from argparse import ArgumentParser
  parser = ArgumentParser()
  # set default port
  parser.add_argument('-p', '--port', default=5000, type=int, help='port to listen on')
  # set default url of a wallet server
  parser.add_argument('-g', '--gw', default='http://127.0.0.1:8080', type=str, help='wallet gateway')

  args = parser.parse_args()
  port = args.port
  app.config['gw'] = args.gw
  app.config['port'] = port

  app.run(host='127.0.0.1', port=port, debug=True)
