import React from 'react';

const MotionLogo = ({ size = 'md', src, type = 'avatar' }: { size?: 'sm' | 'md' | 'lg' | 'xl', src?: string, type?: 'logo' | 'avatar' }) => {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32'
  };
  
  const defaultAvatar = "https://i.ibb.co/wFL95wCK/fshnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn.png";
  const appLogo = "https://i.ibb.co/wFL95wCK/fshnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn.png";
  
  const displaySrc = type === 'logo' ? appLogo : (src || defaultAvatar);
  
  return (
    <div className={`${sizes[size]} rounded-full overflow-hidden border-2 border-white shadow-md relative bg-slate-100 flex-shrink-0`}>
      <img 
        src={displaySrc} 
        alt={type === 'logo' ? "App Logo" : "User Avatar"}
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

export default MotionLogo;
