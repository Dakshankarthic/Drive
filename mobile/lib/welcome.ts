export function firstNameFromProfile(fullName: string): string {
  const trimmed = (fullName || '').trim();
  if (!trimmed || trimmed.toLowerCase() === 'driver') {
    return 'there';
  }
  return trimmed.split(/\s+/)[0];
}

export function buildWelcomeText(profileName: string): string {
  const name = firstNameFromProfile(profileName === 'Driver' ? '' : profileName);
  return (
    `Hi ${name} 👋 I'm your DriveLegal assistant. Ask anything about traffic rules, fines, or paperwork — in plain language.\n\n` +
    `Tip: set your name under You → Your profile.`
  );
}

export const WELCOME_SUGGESTIONS = [
  "What's the fine for no helmet in Tamil Nadu?",
  'Is drunk driving a criminal offence?',
  'What rules apply at my location?',
];
