from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/assign-driver', methods=['POST'])
def assign_driver():
    data = request.json
    order_id = data.get('orderId')
    print(f"Received Order ID {order_id} for automated driver matching...")
    return jsonify({"success": True, "message": "Driver assigned successfully via GCE worker"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)