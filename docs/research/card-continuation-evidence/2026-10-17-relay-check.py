"""Deterministic contract illustrations; not production retrieval or a live pacing POC."""
import base64
import copy
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
INPUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / 'card-projection-evidence' / '2026-10-17-examples.json'
OUTPUT = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT
OUTPUT.mkdir(parents=True, exist_ok=True)
CAP = 51200
FIXTURES = json.loads(INPUT.read_text())['examples']
CARD_FIELDS = 'oracle_id printing_id name layout mana_cost mana_value type_line oracle_text colors color_identity color_indicator produced_mana keywords power toughness loyalty defense legalities game_changer edhrec_rank card_faces tags set set_id set_name set_type collector_number lang printed_name finishes promo_types tcgplayer_id cardmarket_id printing_layout'.split()
PRINT_FIELDS = 'set set_id set_name set_type collector_number lang printed_name finishes promo_types tcgplayer_id cardmarket_id printing_layout'.split()
COPY_FIELDS = 'collection_card_id printing_id quantity location added_at finish condition altered misprint purchase_price purchase_price_currency source_row_number'.split() + PRINT_FIELDS

DESCRIPTIONS = {
    'oracle_id': 'Select the canonical Oracle identity identifier; mandatory on every resolved card even if unselected.',
    'printing_id': 'Select the actual provider-returned or exactly referenced Printing identifier; incompatible with local name/Oracle references.',
    'oracle_text': 'Complete top-level Oracle text and every existing face name/Oracle text in source order; never abbreviated.',
    'card_faces': 'Complete supported face projection for each existing face in order; known no faces is an empty array.',
    'tags': 'Complete approved direct slug/weight/annotation and inherited slug/weight lists; local unavailability is explicit.',
    'mana_value': 'Mana Value; maps provider cmc/local manaValue without exposing a second cmc alias.',
    'layout': 'Canonical gameplay layout, distinct from Printing presentation layout.',
    'printing_layout': 'Printing presentation: standard or reversible_card, distinct from gameplay layout.',
    'colors': 'Preserve absent colors versus a known empty/colorless array.',
    'color_identity': 'Color Identity, distinct from colors.',
    'color_indicator': 'Printed color indicator, preserving known absence.',
    'legalities': 'Complete supported source legality map, not an inferred format filter.',
    'finishes': 'Supported Finish treatments of the actual Printing; not the treatment of an owned row.',
    'finish': 'The singular Finish of this owned Collection row.',
    'location': 'Exact Collection Location ID, type and name for the owned row.',
    'collection_card_id': 'Snapshot-local Collection row identifier; mandatory on every emitted copy row.',
    'quantity': 'Source-row quantity, not an individually tracked physical object or allocation quantity; mandatory on copy rows.',
    'added_at': 'Optional source-added date; never inferred from Set/Printing/import recency.',
    'printed_name': 'Actual Printing supplied Printed Name; no canonical-name substitution.',
}

def encode_json(v):
    return json.dumps(v, ensure_ascii=False, separators=(',', ':'))

def nbytes(v):
    return len(encode_json(v).encode('utf-8'))

def selection_schema(names, copy_rows=False):
    props = {}
    for name in names:
        desc = DESCRIPTIONS.get(name, f'Select the approved {name} fact with the owning projection contract\'s full null/empty/unavailable semantics.')
        if copy_rows and name in PRINT_FIELDS:
            desc = 'Fact of this owned row\'s actual Printing. ' + desc
        props[name] = {'const': True, 'description': desc}
    return {'type': 'object', 'properties': props, 'additionalProperties': False, 'minProperties': 1}

def validate_selection(value, names):
    assert isinstance(value, dict) and value
    assert set(value) <= set(names)
    assert all(v is True for v in value.values())

def convert_request(e):
    r = copy.deepcopy(e['request'])
    r['select'] = {k: True for k in r.pop('fields')}
    if r.get('collection_evidence', {}).get('mode') == 'copies':
        r['collection_evidence']['select'] = {k: True for k in r['collection_evidence'].pop('fields')}
        validate_selection(r['collection_evidence']['select'], COPY_FIELDS)
    validate_selection(r['select'], CARD_FIELDS)
    return r

def immutable_request(r):
    x = copy.deepcopy(r)
    for key in ('select', 'first', 'after'):
        x.pop(key, None)
    if isinstance(x.get('collection_evidence'), dict):
        x['collection_evidence'].pop('select', None)
    return x

def cursor(r, tool, position):
    # Toy private codec. It is self-contained and omits every result buffer.
    state = {'v': 2, 'tool': tool, 'source': 'deterministic-fixture',
             'request': immutable_request(r), 'position': position,
             'imports': {'oracle_cards': 'fixture-oracle', 'all_cards': 'fixture-printing'}}
    if 'collection_evidence' in r:
        state['imports']['collection'] = 'fixture-collection'
    if 'tags' in r['select']:
        state['imports']['oracle_tags'] = 'fixture-tags'
    return base64.urlsafe_b64encode(encode_json(state).encode()).decode().rstrip('=')

def decode(c):
    return json.loads(base64.urlsafe_b64decode(c + '==='))

def pos(page, index, total):
    return {'page': page, 'pageUrl': f'https://api.scryfall.com/cards/search?q=f%3Acommander&page={page}',
            'atPageEnd': index == total - 1,
            'lastId': None if index < 0 else f'00000000-0000-4000-{page:04d}-{index + 1:012d}'}

def metadata(r, tool, count, input_count=0, start=0):
    m = {'requested_count': r['first'], 'returned_count': count,
         'response_budget_bytes': CAP,
         'provider_total': 300 if tool == 'search_cards' else None, 'scoped_total': None}
    if tool == 'lookup_cards':
        m['lookup'] = {'input_count': input_count, 'start_index': start, 'next_index': start + count}
    return m

def success(r, tool, nodes, start_pos, end_pos, more, input_count=0, start=0, stop='first'):
    return {'status': 'ok', 'edges': [{'node': n} for n in nodes],
            'pageInfo': {'startCursor': cursor(r, tool, start_pos) if nodes else None,
                         'endCursor': cursor(r, tool, end_pos) if nodes else None,
                         'hasNextPage': more, 'hasPreviousPage': start > 0},
            'stop_reason': stop, 'metadata': metadata(r, tool, len(nodes), input_count, start)}

def failure(r, tool, code, position, nodes=(), retryable=True, **details):
    e = {'code': code, 'message': code.replace('_', ' '), 'retryable': retryable,
         'cursor': cursor(r, tool, position), **details}
    return {'status': 'error', 'edges': [{'node': n} for n in nodes],
            'error': e, 'metadata': metadata(r, tool, len(nodes))}

measurements = []
examples = []
for i in (0, 2, 4, 5, 12, 14):
    f = FIXTURES[i]
    r = convert_request(f)
    payload = copy.deepcopy(f['response_payload'])
    nodes = payload.pop('results')
    r['first'] = len(nodes)
    if f['tool'] == 'lookup_cards':
        # Add a remaining duplicate input so this illustration truthfully hasNextPage.
        r['references'].append(copy.deepcopy(r['references'][-1]))
        a, b = {'next_input_index': 1}, {'next_input_index': len(nodes)}
        out = success(r, f['tool'], nodes, a, b, True, len(r['references']))
    else:
        out = success(r, f['tool'], nodes, pos(1, 0, len(nodes) + 1), pos(1, len(nodes)-1, len(nodes)+1), True)
    out.update(payload)
    assert nbytes(out) <= CAP
    assert out['metadata']['returned_count'] == len(out['edges'])
    assert 'error' not in out
    state = decode(out['pageInfo']['endCursor'])
    assert state['request'] == immutable_request(r)
    assert 'results' not in state and 'edges' not in state
    if i == 2:
        assert out['edges'][2]['node']['status'] == 'not_found'
        assert out['edges'][0]['node']['card']['oracle_id'] == out['edges'][3]['node']['card']['oracle_id']
    examples.append({'case': f['title'], 'request': r, 'response': out,
                     'note': 'Public/synthetic record facts; remaining input and transport positions are illustrative.'})
    measurements.append({'case': f['title'], 'complete_objects': len(nodes), 'utf8_bytes': nbytes(out)})

# Prove a response can stop mid-provider-page and its ID anchor identifies the
# next object without retaining the downloaded page in the cursor.
template = copy.deepcopy(FIXTURES[4]['response_payload']['results'][0])
r = {'q': 'f:commander', 'unique': 'prints', 'first': 175, 'select': {'card_faces': True}}
raw_page = [{'id': pos(1, i, 175)['lastId'], 'node': copy.deepcopy(template)} for i in range(175)]
prefix = []
for raw in raw_page:
    candidate = success(r, 'search_cards', prefix + [raw['node']], pos(1, 0, 175), pos(1, len(prefix), 175), True, stop='response_budget')
    if nbytes(candidate) > CAP:
        break
    prefix.append(raw['node'])
assert 0 < len(prefix) < 175
out = success(r, 'search_cards', prefix, pos(1, 0, 175), pos(1, len(prefix)-1, 175), True, stop='response_budget')
anchor = decode(out['pageInfo']['endCursor'])['position']
assert anchor['atPageEnd'] is False
matches = [i for i, raw in enumerate(raw_page) if raw['id'] == anchor['lastId']]
assert matches == [len(prefix)-1]
assert raw_page[matches[0]+1]['id'] == pos(1, len(prefix), 175)['lastId']
assert nbytes(out) <= CAP
assert nbytes(success(r, 'search_cards', prefix+[raw_page[len(prefix)]['node']], pos(1,0,175),pos(1,len(prefix),175),True,stop='response_budget')) > CAP
measurements.append({'case': 'Synthetic full-face boundary with mid-page ID anchor', 'complete_objects': len(prefix), 'utf8_bytes': nbytes(out)})
examples.append({'case': 'Mid-page byte boundary', 'response': out,
                 'note': 'Repeated fixture facts with synthetic distinct transport IDs, not a representative provider page.'})

# A completed page moves to the next supplied page; a missing/ambiguous anchor
# must never silently become a numeric offset or a different occurrence.
end_state = pos(1, 174, 175)
assert end_state['atPageEnd'] and end_state['page'] + 1 == 2
changed_page = [x for x in raw_page if x['id'] != anchor['lastId']]
assert not [x for x in changed_page if x['id'] == anchor['lastId']]
duplicated = raw_page + [copy.deepcopy(raw_page[matches[0]])]
assert len([x for x in duplicated if x['id'] == anchor['lastId']]) == 2

# Empty scan timeout: a sole error cursor can advance after fully examined,
# filtered-out source objects. It is not a normal endCursor/Relay page.
timeout = failure(r, 'search_cards', 'scan_timeout', pos(80, 174, 175))
assert timeout['edges'] == [] and 'pageInfo' not in timeout
checkpoint = decode(timeout['error']['cursor'])['position']
assert checkpoint['atPageEnd'] and checkpoint['page'] + 1 == 81
assert nbytes(timeout) <= CAP
measurements.append({'case': 'Zero-match timeout with recovery after page 80', 'complete_objects': 0, 'utf8_bytes': nbytes(timeout)})
examples.append({'case': 'Empty timed-out scan recovery', 'response': timeout,
                 'note': 'Assumed safely examined nonmatching source prefix; illustrates recovery encoding, not query execution or elapsed time.'})

partial = failure(r, 'search_cards', 'scan_timeout', pos(4, 174, 175), prefix[:2])
assert 'pageInfo' not in partial and partial['metadata']['returned_count'] == 2
measurements.append({'case': 'Partial timeout with two intact results and one recovery cursor', 'complete_objects': 2, 'utf8_bytes': nbytes(partial)})
examples.append({'case': 'Partial timeout', 'response': partial})

too_big = copy.deepcopy(template)
too_big['card']['oracle_text'] = '界\\"\n' * 12000
required = nbytes(success(r,'search_cards',[too_big],pos(1,0,175),pos(1,0,175),True))
assert required > CAP
oversize = failure(r,'search_cards','record_too_large',pos(1,-1,175),retryable=False,required_bytes=required,limit_bytes=CAP)
assert not oversize['edges'] and 'recovery' not in oversize['error']
assert decode(oversize['error']['cursor'])['position']['lastId'] is None
assert nbytes(oversize) <= CAP
measurements.append({'case': 'Oversized indivisible object error before first object', 'complete_objects': 0, 'utf8_bytes': nbytes(oversize), 'required_bytes': required})
examples.append({'case': 'Indivisible object overflow', 'response': oversize})

# Selection is a closed schema; ordinary projection changes do not alter the
# query binding, but changing q does. Omission never inherits fixed inputs.
for bad in ({}, {'made_up': True}, {'name': False}, {'name': 'true'}):
    try:
        validate_selection(bad, CARD_FIELDS)
    except AssertionError:
        pass
    else:
        raise AssertionError('invalid selector accepted')
changed = {**r, 'select': {'name': True}, 'first': 50}
assert immutable_request(changed) == immutable_request(r)
assert immutable_request({**changed, 'q': 'f:standard'}) != immutable_request(r)
omitted_unique = dict(changed)
omitted_unique.pop('unique')
assert immutable_request(omitted_unique) != immutable_request(r)

schemas = {'$schema': 'https://json-schema.org/draft/2020-12/schema',
           '$defs': {'CardSelection': selection_schema(CARD_FIELDS),
                     'CopySelection': selection_schema(COPY_FIELDS, True)}}
report = {'status': 'review_schema_illustrations_not_production_tests_or_live_pacing',
          'budget_bytes': CAP, 'measurements': measurements,
          'checks': ['closed typed selectors', 'full-envelope UTF-8 sizing',
                     'mid/end provider-page source-ID positions', 'missing/ambiguous anchor detection',
                     'lookup duplicate/miss correspondence', 'empty/partial error recovery cursor',
                     'indivisible oversized object', 'fixed query binding with mutable selection']}
for filename, value in (
    ('2026-10-17-relay-selectors.schema.json', schemas),
    ('2026-10-17-relay-envelope-examples.json', {'status': report['status'], 'examples': examples}),
    ('2026-10-17-relay-envelope-measurements.json', report),
):
    (OUTPUT / filename).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(report, ensure_ascii=False, indent=2))
