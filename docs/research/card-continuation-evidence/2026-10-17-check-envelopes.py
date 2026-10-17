import base64
import copy
import json
import sys
from pathlib import Path

CAP = 51200
fixture_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / 'card-projection-evidence' / '2026-10-17-examples.json'
output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).with_name('2026-10-17-envelope-measurements.json')
fixtures = json.loads(fixture_path.read_text())['examples']

def serialized(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))

def size(value):
    return len(serialized(value).encode('utf-8'))

def request(example):
    r = copy.deepcopy(example['request'])
    r['page_size'] = r.pop('first', 50)
    return r

def token(r, tool, index):
    # Representative self-contained encoding, not the normative private codec.
    position = {'reference_index': index} if tool == 'lookup_cards' else {
        'provider_page_url': 'https://api.scryfall.com/cards/search?page=1&q=f%3Acommander',
        'next_record_index': index,
    }
    imports = {}
    if tool == 'lookup_cards' or 'collection_evidence' in r:
        imports.update({'oracle_cards': 'fixture-import-1', 'all_cards': 'fixture-import-2'})
    if 'collection_evidence' in r:
        imports['collection'] = 'fixture-collection-import'
    if 'tags' in r.get('fields', []):
        imports['oracle_tags'] = 'fixture-tags-import'
    state = {'v': 1, 'tool': tool, 'provider': 'fixture-scryfall' if tool == 'search_cards' else 'fixture-local-reference',
             'request': r, 'position': position, 'imports': imports}
    return base64.urlsafe_b64encode(serialized(state).encode()).decode().rstrip('=')

def page(r, tool, records, index=0, exhausted=False, stop=None, error=None):
    next_index = index + len(records)
    p = {
        'requested_count': r['page_size'], 'returned_count': len(records),
        'stop_reason': stop or ('source_exhausted' if exhausted else 'page_size'),
        'source_exhausted': exhausted, 'can_continue': not exhausted,
        'continuation': None if exhausted else token(r, tool, next_index),
        'provider_total': 1000 if tool == 'search_cards' else None,
        'scoped_total': None, 'response_budget_bytes': CAP,
    }
    if tool == 'lookup_cards':
        p['lookup'] = {'input_count': len(r['references']), 'start_index': index,
                       'next_index': next_index}
    result = {'status': 'partial' if error and (records or index) else ('error' if error else 'ok'),
              'results': records, 'page': p}
    if error:
        result['error'] = error
    return result

measurements = []
envelopes = []
for i in (0, 2, 4, 5, 12, 14):
    e = fixtures[i]
    r = request(e)
    payload = copy.deepcopy(e['response_payload'])
    r['page_size'] = len(payload['results'])
    if e['tool'] == 'lookup_cards':
        r['references'].append(copy.deepcopy(r['references'][-1]))
    # Use an unexhausted fixture position to reserve a real encoded token.
    # Copy/evidence and provenance examples are retained as complete payloads.
    envelope = page(r, e['tool'], payload.pop('results'))
    envelope.update(payload)
    assert envelope['page']['returned_count'] == len(envelope['results'])
    assert size(envelope) <= CAP
    decoded = json.loads(base64.urlsafe_b64decode(envelope['page']['continuation'] + '==='))
    assert decoded['request'] == r
    assert 'results' not in decoded
    measurements.append({'case': e['title'], 'records': len(envelope['results']),
                         'utf8_bytes': size(envelope),
                         'token_characters': len(envelope['page']['continuation'])})
    envelopes.append(envelope)

# A static ordered outer list: choose the longest complete prefix that fits,
# reserving its actual next-position token and final metadata at each step.
r = {'q': 'f:commander', 'fields': ['oracle_text', 'card_faces'], 'page_size': 200}
base = fixtures[4]['response_payload']['results'][0]
records = [copy.deepcopy(base) for _ in range(200)]
for i, record in enumerate(records):
    record['card']['oracle_id'] = f'00000000-0000-4000-8000-{i:012d}'
prefix = []
for record in records:
    candidate = page(r, 'search_cards', prefix + [record], stop='response_budget')
    if size(candidate) > CAP:
        break
    prefix.append(record)
bounded = page(r, 'search_cards', prefix, stop='response_budget')
assert 0 < len(prefix) < 200
assert size(bounded) <= CAP
assert size(page(r, 'search_cards', prefix + [records[len(prefix)]], stop='response_budget')) > CAP
state = json.loads(base64.urlsafe_b64decode(bounded['page']['continuation'] + '==='))
assert state['position']['next_record_index'] == len(prefix)
assert bounded['results'] == records[:len(prefix)]
measurements.append({'case': 'Synthetic boundary: repeated complete face fixtures',
                     'records': len(prefix), 'utf8_bytes': size(bounded),
                     'next_record_fits': False})

# A whole object cannot fit: zero emitted records, same unconsumed position,
# a structured error without a recovery prescription, and an intact token.
oversized = copy.deepcopy(base)
oversized['card']['oracle_text'] = '界\\"\n' * 12000
required = size(page(r, 'search_cards', [oversized]))
assert required > CAP
error = {'code': 'record_too_large', 'message': 'A complete result exceeds the response budget.',
         'retryable': False, 'required_bytes': required, 'limit_bytes': CAP}
failed = page(r, 'search_cards', [], stop='record_too_large', error=error)
assert failed['status'] == 'error' and failed['results'] == [] and size(failed) <= CAP
assert 'recovery' not in failed['error']
state = json.loads(base64.urlsafe_b64decode(failed['page']['continuation'] + '==='))
assert state['position']['next_record_index'] == 0
measurements.append({'case': 'Synthetic oversized escaped/non-ASCII record error',
                     'records': 0, 'utf8_bytes': size(failed), 'required_bytes': required})

# Self-contained input can itself exceed capacity; it must reject before work.
large = {'references': [{'kind': 'name', 'value': 'Cultivate'} for _ in range(5000)],
         'fields': ['name'], 'page_size': 50}
large_metadata = page(large, 'lookup_cards', [])
assert size(large_metadata) > CAP

out = {'status': 'draft_schema_fixture_check_not_implementation_tests',
       'budget_bytes': CAP, 'measurements': measurements,
       'oversized_token_metadata_bytes': size(large_metadata), 'envelopes': envelopes}
output_path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k: v for k, v in out.items() if k != 'envelopes'}, ensure_ascii=False, indent=2))
