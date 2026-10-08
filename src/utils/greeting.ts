export function getGreeting(name?: string) {
  const hour = new Date().getHours();

  let greeting;
  if (hour < 5) {
    greeting = 'Good night';
  } else if (hour < 12) {
    greeting = 'Good morning';
  } else if (hour < 17) {
    greeting = 'Good afternoon';
  } else if (hour < 21) {
    greeting = 'Good evening';
  } else {
    greeting = 'Good night';
  }

  return name ? `${greeting}, ${name}` : greeting;
}

const GREETINGS = [
  'What do you want to listen to?',
  'What are we playing today?',
  'Ready to listen?',
  'What sounds good right now?',
  'Pick something to play',
  'What\'s the vibe today?',
  'Let\'s find something to play',
  'What do you feel like hearing?',
  'Time to queue something up',
  'What should we play?',
];

export function getGreeter() {
  const index = Math.floor(Math.random() * GREETINGS.length);
  return GREETINGS[index];
}
