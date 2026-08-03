let unlocked = false;

export function installAudioUnlock(): void {
  if (unlocked) return;
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;

    try {
      const silence = new Audio(
        'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC7k1mEDkTt/2mBW2j6+GwF+Y0lRIQZBQhZBqO2gp2rf9EqUyKC4NBQ1jm9NN9jaAERTIWANEFyIf/6yr7GjqrJc'
      );
      silence.volume = 0;
      void silence.play().catch(() => {});
    } catch {
      // ignore
    }

    try {
      if (window.speechSynthesis) {
        const utter = new SpeechSynthesisUtterance('');
        utter.volume = 0;
        window.speechSynthesis.speak(utter);
      }
    } catch {
      // ignore
    }

    window.removeEventListener('touchend', unlock);
    window.removeEventListener('click', unlock);
  };

  window.addEventListener('touchend', unlock, { once: true });
  window.addEventListener('click', unlock, { once: true });
}
