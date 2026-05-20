import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LocateFixed } from 'lucide-react';

interface LocationPromptProps {
  isVisible: boolean;
  onGetGeolocation: () => void;
  onManualSelect: () => void;
}

export const LocationPrompt: React.FC<LocationPromptProps> = ({ 
  isVisible, 
  onGetGeolocation, 
  onManualSelect 
}) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-[1100] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-6"
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="bg-white p-8 rounded-[3rem] shadow-2xl max-w-md w-full text-center space-y-8 border-4 border-orange-100"
          >
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto text-orange-500">
              <LocateFixed size={40} />
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">Set Your Location</h2>
              <p className="text-slate-500 font-medium mt-2">To find the best gems nearby, we need to know where you are starting from.</p>
            </div>
            <div className="space-y-3">
              <button 
                onClick={onGetGeolocation}
                className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-orange-600 shadow-xl shadow-orange-100 transition-all"
              >
                Use Automatic Location ➔
              </button>
              <button 
                onClick={onManualSelect}
                className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-black transition-all hover:bg-slate-200"
              >
                Set Manually on Map
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
