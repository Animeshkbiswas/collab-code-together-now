# app.py
from flask import Flask, request, jsonify
from transcript import give_summary
from flask_cors import CORS
import threading
from concentration_tracker import track_concentration
from flask import Response
import time

app = Flask(__name__)
CORS(app)

# Start concentration tracker in a background thread
concentration_triggered = False
score_container = {'value': 0}
frame_container = {'frame': None}

def monitor_concentration():
    global concentration_triggered
    concentration_triggered = track_concentration(score_container,frame_container)
@app.route('/video_feed')
def video_feed():
    """Video streaming route that reads from frame_container."""
    def generate():
        while True:
            if frame_container['frame'] is not None:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_container['frame'] + b'\r\n')
            time.sleep(0.033)  
    
    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/score_feed')
def score_feed():
    def event_stream():
        while True:
            score = score_container['value']
            yield f"data: {score}\n\n"
            time.sleep(0.5)

    return Response(event_stream(), mimetype='text/event-stream')


@app.route('/summarize', methods=['POST'])
def summarize():
    global concentration_triggered

    data = request.get_json()
    link = data.get('link')
    time_stamp = data.get('time_stamp', 0)
    print(f"Received link: {link}, time_stamp: {time_stamp}")

    # Start concentration monitoring
    concentration_thread = threading.Thread(target=monitor_concentration)
    concentration_thread.start()
    concentration_thread.join()

    if concentration_triggered:
        summarizer = give_summary(link)
        summary, quiz = summarizer.summarize(time_stamp)
        return jsonify({'summary': summary, 'quiz': quiz})
    else:
        return jsonify({'summary': '', 'quiz': [], 'message': 'User did not lose concentration'})
