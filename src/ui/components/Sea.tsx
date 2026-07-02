// Sfondo "mare animato": layer decorativo fisso dietro le schermate
// (onde che scorrono, risacca, luccichio). Markup allineato al progetto
// design "myTan" su claude.ai/design; gli stili vivono in styles.css (.sea).

export function Sea() {
  return (
    <div className="sea" aria-hidden="true">
      <div className="glint" />
      <div className="wave wave-back">
        <svg viewBox="0 0 2880 140" preserveAspectRatio="none">
          <path
            fill="#cfe8e6"
            d="M0,70 C240,20 480,120 720,70 C960,20 1200,120 1440,70 C1680,20 1920,120 2160,70 C2400,20 2640,120 2880,70 L2880,140 L0,140 Z"
          />
        </svg>
      </div>
      <div className="wave wave-front">
        <svg viewBox="0 0 2880 140" preserveAspectRatio="none">
          <path
            fill="#ffffff"
            d="M0,60 C240,110 480,10 720,60 C960,110 1200,10 1440,60 C1680,110 1920,10 2160,60 C2400,110 2640,10 2880,60 L2880,140 L0,140 Z"
          />
        </svg>
      </div>
      <div className="wash" />
    </div>
  );
}
