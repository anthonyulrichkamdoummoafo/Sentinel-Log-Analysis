import random
import time
import datetime
import sys

# Simulation of NASA Kennedy Space Center HTTP dataset format
# 199.72.81.55 - - [01/Jul/1995:00:00:01 -0400] "GET /history/apollo/ HTTP/1.0" 200 6245

IPS = [
    "192.168.1.1", "10.0.0.5", "172.16.0.100", "8.8.8.8", "1.1.1.1",
    "45.32.11.9", "89.201.3.44", "210.10.22.1", "5.5.5.5", "123.123.123.123"
]

PATHS = [
    "/index.html", "/about", "/api/v1/auth", "/login", "/static/css/main.css",
    "/history/apollo/", "/images/nasa-logo.gif", "/software/winvn/", "/news/1995/"
]

METHODS = ["GET", "POST", "PUT", "DELETE"]
STATUS_CODES = [200, 200, 200, 200, 200, 301, 302, 404, 404, 500]

def generate_log_line():
    ip = random.choice(IPS)
    # Simulate a "DDoS" or "Probing" attack occasionally
    if random.random() < 0.05:
        ip = "ATTACKER_IP_999"
    
    timestamp = datetime.datetime.now().strftime("%d/%b/%Y:%H:%M:%S -0400")
    method = random.choice(METHODS)
    path = random.choice(PATHS)
    
    # 404 flooding simulation
    if ip == "ATTACKER_IP_999" and random.random() < 0.7:
        status = 404
        path = f"/secret-path-{random.randint(1,1000)}"
    else:
        status = random.choice(STATUS_CODES)
        
    bytes_sent = random.randint(100, 10000)
    
    return f'{ip} - - [{timestamp}] "{method} {path} HTTP/1.0" {status} {bytes_sent}'

if __name__ == "__main__":
    # Generate logs to stdout
    while True:
        print(generate_log_line())
        sys.stdout.flush()
        time.sleep(random.uniform(0.1, 0.5))
