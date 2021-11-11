from flask import Flask, render_template, jsonify, request
import requests
import urllib.parse

from Wallet import Wallet

app = Flask(__name__, template_folder='./templates')
cache = {}

"""
Serve a request from frontend
"""
@app.route('/<init_id>')
def index(init_id):
  return render_template('./index.html', init_id=init_id)

@app.route('/wallet', methods=['GET', 'POST'])
def create_wallet():
  """
  GET: return a wallet if there's a matching wallet 
  wallet id is required
  """
  if request.method == 'GET':
    required = ['wallet_id']
    if not all(k in request.args for k in required):
      return 'Missing values', 400

    wallet_id = request.args.get('wallet_id')
    wallet = cache.get(wallet_id)
    if wallet == None:
      return jsonify({'message': 'not found'}), 400 
    
    response = {
      'wallet_id': cache[wallet_id].wallet_id,
      'private_key': cache[wallet_id].private_key,
      'public_key': cache[wallet_id].public_key,
      'password': cache[wallet_id].password
    }
    print(cache)
    return jsonify(response), 200 

  """
  POST: create a new wallet
  wallet id is required
  """
  if request.method == 'POST':
    request_json = request.json
    required = ['wallet_id']

    if not all(k in request_json for k in required):
        return jsonify({'message': 'missing values'}), 400

    wallet = Wallet(creator=True) if request.json and request.json['wallet_id'] == 'creator' else Wallet(wallet_id=request_json['wallet_id'])
    id = wallet.wallet_id
    cache[id] = wallet
    response = {
      'wallet_id': cache[id].wallet_id,
      'private_key': cache[id].private_key,
      'public_key': cache[id].public_key,
      'password': cache[id].password
    }
    print(cache)
    return jsonify(response), 201

@app.route('/send_money', methods=['POST'])
def send_money():
  """
  Send money to a recipient public key
  recipient public key, message, and wallet id are required
  """
  request_json = request.json
  required = (
      'recipient_public_key',
      'message',
      'wallet_id')
  if not all(k in request_json for k in required):
      return jsonify({'message': 'missing values'}), 400

  wallet_id = request_json['wallet_id']
  wallet = cache[wallet_id]
  data = {
      'receiver_pks': request_json['recipient_public_key'],
      'msgs': request_json['message'],
      'private_key': wallet.private_key,
      'password': wallet.password
  }

  # Call wallet server's transfer api
  response = requests.post(
      urllib.parse.urljoin(app.config['gw'], 'transfer'),
      json=data, timeout=3)

  if response.status_code == 201:
      return jsonify({'message': 'success'}), 201
  return jsonify({'message': 'fail', 'response': response}), 400

@app.route('/get_balance', methods=['POST'])
def get_balance():
  """
  Get balance of a wallet
  wallet id is required
  """
  request_json = request.json
  required = ['wallet_id']
  if not all(k in request_json for k in required):
      return jsonify({'message': 'missing values'}), 400

  wallet_id = request_json['wallet_id']
  wallet = cache[wallet_id]

  # Get a wallet balance through wallet server
  response = requests.get(
      urllib.parse.urljoin(app.config['gw'], 'balance'),
      {
        'private_key': wallet.private_key,
        'password': wallet.password
      },
      timeout=3)
  if response.status_code == 200:
      total = response.json()['amount']
      return jsonify({'message': 'success', 'amount': total}), 200
  return jsonify({'message': 'fail', 'error': response.content}), 400

if __name__ == '__main__':
  from argparse import ArgumentParser
  parser = ArgumentParser()
  # set default port
  parser.add_argument('-p', '--port', default=8080, type=int, help='port to listen on')
  # set default url of a blockchain server
  parser.add_argument('-g', '--gw', default='http://127.0.0.1:5000', type=str, help='blockchain gateway')
  args = parser.parse_args()
  port = args.port
  app.config['gw'] = args.gw

  app.run(host='127.0.0.1', port=port, debug=True)