"""Validate captured sources and save a portable, resumable test checkpoint."""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from validate_portal_capture import ROOT, validate


def save_checkpoint(root=ROOT, boundary_pages=(), status='paused_for_user_testing'):
    root = Path(root)
    report = validate(root)
    folder = root / 'data/portal_capture'
    plan_bytes = (folder / 'details-plan.json').read_bytes()
    plan = json.loads(plan_bytes.decode('utf-8-sig'))
    completed = {p.stem for p in (folder / 'details').glob('*.json')}
    finished, pending = [], []
    for page in plan:
        remaining = [t for t in page['targets'] if f"{t['number']}-{t['va']}" not in completed]
        if remaining:
            pending.append({'index': page['index'], 'label': page['label'],
                            'remaining': len(remaining), 'next_target': remaining[0]})
        else:
            finished.append(page['index'])
    if any(index not in finished for index in boundary_pages):
        raise ValueError('Ein als Haltepunkt gewählter Abschnitt ist noch nicht vollständig.')
    checkpoint = {
        'schema': 1,
        'saved_at': datetime.now(timezone.utc).isoformat(),
        'status': status,
        'catalogue_year': 2026,
        'source': 'https://digital.asteigerag.ch/dashboard',
        'validation': report,
        'remaining_details': report['planned_details'] - report['detail_records'],
        'plan_sha256': hashlib.sha256(plan_bytes).hexdigest(),
        'completed_keys_sha256': hashlib.sha256(('\n'.join(sorted(completed)) + '\n').encode()).hexdigest(),
        'completed_keys': sorted(completed),
        'completed_pages': finished,
        'boundary_pages': list(boundary_pages),
        'pending_pages': pending,
        'resume': {
            'guide': 'docs/ERFASSUNG_FORTSETZEN.md',
            'module': 'tools/resume_portal_capture.mjs',
            'entry_point': 'resumeCapture(root, tabs, options)',
            'source_of_truth': 'data/portal_capture/details/*.json',
            'skip_completed': True,
        },
    }
    target = folder / 'resume_checkpoint.json'
    temporary = target.with_suffix('.json.capture-next')
    temporary.write_text(json.dumps(checkpoint, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    temporary.replace(target)
    return {'checkpoint': str(target), **report,
            'completed_pages': len(finished), 'remaining_details': checkpoint['remaining_details']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--boundary-pages', default='')
    parser.add_argument('--status', choices=('paused_for_user_testing', 'in_progress', 'awaiting_portal_login', 'complete'), default='paused_for_user_testing')
    args = parser.parse_args()
    print(json.dumps(save_checkpoint(args.root, tuple(filter(None, args.boundary_pages.split(','))), args.status), ensure_ascii=False))
