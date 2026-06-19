import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LocateFixed } from 'lucide-react';

interface LocationPromptProps {
  isVisible: boolean;
  onGetGeolocation: () => void;
  onManualSelect: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export const LocationPrompt: React.FC<LocationPromptProps> = ({ 
  isVisible, 
  onGetGeolocation, 
  onManualSelect,
  isLoading = false,
  error = null
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
            className="bg-white p-8 rounded-[3rem] shadow-2xl max-w-md w-full text-center space-y-6 border-4 border-orange-100"
          >
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto text-orange-500">
              <LocateFixed size={40} className={isLoading ? "animate-spin" : ""} />
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">Set Your Location</h2>
              <p className="text-slate-500 font-medium mt-2">To find the best gems nearby, we need to know where you are starting from.</p>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 text-red-600 text-xs font-semibold p-4 rounded-2xl border border-red-100 text-left leading-relaxed shadow-sm"
              >
                ⚠️ {error}
              </motion.div>
            )}

            <div className="space-y-3">
              <button 
                onClick={onGetGeolocation}
                disabled={isLoading}
                className={`w-full text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl hover:shadow-orange-200 transition-all ${
                  isLoading 
                    ? 'bg-orange-400 cursor-not-allowed' 
                    : 'bg-orange-500 hover:bg-orange-600 shadow-orange-100'
                }`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Locating... Please wait
                  </>
                ) : (
                  'Use Automatic Location ➔'
                )}
              </button>
              <button 
                onClick={onManualSelect}
                disabled={isLoading}
                className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-black transition-all hover:bg-slate-200 disabled:opacity-50"
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
