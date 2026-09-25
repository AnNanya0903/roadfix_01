import type { Category, Facility, Severity } from './domain';
import { CATEGORY_META } from './domain';

export interface GrievanceInput {
  category: Category;
  severity: Severity;
  address: string;
  latitude: number;
  longitude: number;
  description: string;
  at: Date;
  facilities: Facility[] | null;
  supporters?: number;
  hasPhoto: boolean;
  aiAssisted: boolean;
}

export type GrievanceVariant = 'formal' | 'concise' | 'detailed';
export const GRIEVANCE_VARIANTS: GrievanceVariant[] = ['formal', 'concise', 'detailed'];

const IMPACT: Record<Category, string> = {
  pothole: 'Two-wheelers and cars can lose control or suffer vehicle damage, especially at night and in the rain.',
  road_crack: 'The surface is deteriorating and can widen into a pothole if it is not sealed.',
  waterlogging: 'Standing water makes the carriageway unsafe, hides road damage and slows emergency vehicles.',
  streetlight: 'The stretch is dark after sunset, which raises the risk of accidents and personal-safety incidents.',
  fallen_tree: 'The obstruction narrows or blocks the carriageway and can cause collisions.',
  debris: 'Loose material on the road can cause skids and punctures.',
  damaged_sign: 'Drivers may miss warnings or right-of-way information.',
  open_manhole: 'An uncovered manhole is a serious fall and crash hazard for pedestrians and riders.',
  obstruction: 'The blockage forces vehicles into oncoming lanes and slows traffic.',
  other: 'The issue creates inconvenience and a possible safety risk for road users.',
};

const ACTION: Record<Category, string> = {
  pothole: 'Please inspect the location and repair the pothole.',
  road_crack: 'Please inspect the surface and schedule crack sealing or resurfacing.',
  waterlogging: 'Please clear the drain or outlet and check the drainage design at this spot.',
  streetlight: 'Please repair or replace the streetlight.',
  fallen_tree: 'Please remove the fallen tree and clear the road.',
  debris: 'Please clear the debris and check for the source.',
  damaged_sign: 'Please repair or replace the traffic sign.',
  open_manhole: 'Please cover the manhole immediately and place a temporary barrier until it is secured.',
  obstruction: 'Please remove the obstruction and restore safe passage.',
  other: 'Please inspect the location and take suitable corrective action.',
};

function landmark(facilities: Facility[] | null): string {
  if (facilities === null) return 'Nearby landmark information was not available.';
  const f = [...facilities].sort((a, b) => a.distanceM - b.distanceM)[0];
  if (!f) return 'No sensitive location found nearby.';
  return `About ${Math.round(f.distanceM / 10) * 10} m from ${f.name} (${f.kind.replace(/_/g, ' ')}).`;
}

export function grievanceTitle(input: Pick<GrievanceInput, 'category' | 'severity' | 'address'>): string {
  const sev = input.severity === 'high' ? 'Severe' : input.severity === 'medium' ? 'Moderate' : 'Minor';
  const place = input.address.split(',')[0] || 'the pinned location';
  return `${sev} ${CATEGORY_META[input.category].label.toLowerCase()} reported near ${place}`;
}

export function buildGrievance(input: GrievanceInput, variant: GrievanceVariant = 'formal'): { title: string; body: string } {
  const title = grievanceTitle(input);
  const when = input.at.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const dept = CATEGORY_META[input.category].department;
  const evidence = [input.hasPhoto ? 'Photo attached' : 'No photo attached', 'GPS coordinates recorded', input.supporters && input.supporters > 1 ? `${input.supporters} citizens have reported or confirmed this location` : null]
    .filter(Boolean)
    .join('; ');
  const aiLine = input.aiAssisted ? 'An AI-assisted first check flagged this as a possible issue; the reporter has reviewed and confirmed the details.' : 'Details were entered by the reporter.';
  const coords = `${input.latitude.toFixed(5)}, ${input.longitude.toFixed(5)}`;

  if (variant === 'concise') {
    return {
      title,
      body: `To: ${dept}\nSubject: ${title}\n\n${CATEGORY_META[input.category].label} at ${input.address || coords} (${coords}), observed ${when}. Severity: ${input.severity}.\n${input.description}\n\nImpact: ${IMPACT[input.category]}\nRequest: ${ACTION[input.category]}\n\nEvidence: ${evidence}.`,
    };
  }

  const core = `Issue: ${CATEGORY_META[input.category].label}\nLocation: ${input.address || 'Pinned on map'} (${coords})\nDate and time observed: ${when}\nEvidence: ${evidence}\nSeverity (reporter-reviewed): ${input.severity}\nNearby landmark: ${landmark(input.facilities)}\nImpact: ${IMPACT[input.category]}\nRequested action: ${ACTION[input.category]}`;

  if (variant === 'detailed') {
    return {
      title,
      body: `To,\nThe Concerned Officer, ${dept}\n\nSubject: ${title}\n\nRespected Sir/Madam,\n\nI wish to bring the following road-safety problem to your attention.\n\n${core}\n\nDescription from the reporter:\n${input.description}\n\n${aiLine}\n\nI request an inspection, a reference number for this complaint, and an update once the work is complete. I am willing to confirm the repair from the site.\n\nYours sincerely,\nA concerned citizen`,
    };
  }

  return {
    title,
    body: `To,\nThe Concerned Officer, ${dept}\n\nSubject: ${title}\n\n${core}\n\nDescription: ${input.description}\n\n${aiLine}\n\nThank you for your attention.\nA concerned citizen`,
  };
}
