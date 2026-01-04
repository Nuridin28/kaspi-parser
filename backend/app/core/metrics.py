from prometheus_client import Counter, Histogram, Gauge, generate_latest
from fastapi import Response

parsing_requests = Counter('parsing_requests_total', 'Total parsing requests')
parsing_duration = Histogram('parsing_duration_seconds', 'Parsing duration in seconds')
active_jobs = Gauge('active_parsing_jobs', 'Number of active parsing jobs')
failed_parsing = Counter('parsing_failed_total', 'Total failed parsing requests')
successful_parsing = Counter('parsing_successful_total', 'Total successful parsing requests')

def get_metrics():
    return generate_latest()

