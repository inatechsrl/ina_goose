import brandIcon from '../images/logo-transparent.png';

export default function WelcomeGooseLogo({ className = 'w-28 h-9' }) {
  return (
    <div className={`${className} relative overflow-hidden`}>
      <div className="absolute inset-0 flex items-center justify-center">
        <img src={brandIcon} alt="Agent Core logo" className="w-full h-full z-2 object-contain" />
      </div>
    </div>
  );
}
