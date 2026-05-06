import re
from datetime import datetime
from collections import Counter

# DELIVERABLE: PHASE 2 - BATCH ANALYSIS SIMULATION (Mimicking PySpark logic)

LOG_FILE = "nasa_sample.log"
REGEX = r'^(\S+) - - \[(.*?)\] "(.*?) (.*?) (.*?)" (\d+) (\d+)$'

def analyze_logs():
    print("--- SENTINEL BATCH ANALYSIS REPORT ---")
    print(f"Loading data from: {LOG_FILE}")
    
    ips = []
    paths = []
    status_codes = []
    hourly_volume = Counter()
    missing_pages_by_ip = Counter()

    with open(LOG_FILE, 'r') as f:
        for line in f:
            match = re.match(REGEX, line)
            if not match: continue
            
            ip, ts_str, method, path, proto, status, size = match.groups()
            
            # 1. Store counts
            ips.append(ip)
            paths.append(path)
            status_codes.append(status)
            
            # 2. Hourly volume analysis
            try:
                # [01/Jul/1995:00:00:01 -0400]
                ts = datetime.strptime(ts_str.split(' ')[0], "%d/%b/%Y:%H:%M:%S")
                hourly_volume[ts.hour] += 1
            except: pass
            
            # 3. 404 responses filtered by IP
            if status == "404":
                missing_pages_by_ip[ip] += 1

    # TOP 20 IPs
    print("\n[TOP 20 IPs by Request Count]")
    for ip, count in Counter(ips).most_common(20):
        print(f"{ip:20} | {count} requests")

    # TOP PATHS
    print("\n[MOST REQUESTED PATHS]")
    for path, count in Counter(paths).most_common(5):
        print(f"{path:40} | {count}")

    # HOURLY VOLUME
    print("\n[HOURLY REQUEST VOLUME]")
    for hour in sorted(hourly_volume.keys()):
        print(f"Hour {hour:02d}:00 | {hourly_volume[hour]} requests")

    # 404 BY IP
    print("\n[404 RESPONSES BY IP - SUSPICIOUS ACTIVITY]")
    for ip, count in missing_pages_by_ip.most_common():
        print(f"{ip:20} | {count} 404 errors")

if __name__ == "__main__":
    analyze_logs()
