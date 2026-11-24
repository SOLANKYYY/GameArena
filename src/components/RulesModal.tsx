'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const gameRules = [
  {
    icon: '🚀',
    name: 'Limbo',
    color: '#4dabf7',
    desc: 'Set a target multiplier (e.g. 2×). The game generates a random multiplier. If the result is equal to or higher than your target — you win! Higher targets = bigger risk, bigger reward.',
  },
  {
    icon: '🎲',
    name: 'Dice',
    color: '#c084fc',
    desc: 'Pick a number and choose "Roll Over" or "Roll Under". A dice rolls between 0–100. If the result matches your prediction direction, you win! The closer your target to the edge, the higher the payout.',
  },
  {
    icon: '💎',
    name: 'Mines',
    color: '#22d3ee',
    desc: 'A grid hides gems 💎 and mines 💣. Click tiles to reveal gems — each gem increases your multiplier. Hit a mine and you lose. You can cash out anytime to keep your winnings!',
  },
  {
    icon: '🔨',
    name: 'Moles',
    color: '#fb923c',
    desc: 'Moles hide under holes. Pick which hole the mole is under. Get it right to move to the next round with a higher multiplier. Get it wrong and you lose. Cash out anytime!',
  },
  {
    icon: '🎡',
    name: 'Wheel',
    color: '#f472b6',
    desc: 'Spin the fortune wheel! It has different colored segments — each color has a different payout multiplier. Place your bet, spin, and see where the wheel lands.',
  },
  {
    icon: '📍',
    name: 'Plinko',
    color: '#ed4163',
    desc: 'Drop a ball from the top of a pin board. It bounces left and right through pins and lands in a payout slot at the bottom. Center slots pay less, edge slots pay big!',
  },
  {
    icon: '🎯',
    name: 'Keno',
    color: '#fbbf24',
    desc: 'Pick up to 10 numbers from a grid of 40. The game draws 10 random numbers. The more of your picks that match the draw, the higher your payout. It\'s like a lottery!',
  },
];

export default function RulesModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'rules' | 'games'>('rules');
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem('rulesAccepted');
    if (!accepted) {
      setIsOpen(true);
      setIsFirstVisit(true);
    }
  }, []);

  // Listen for external open events (from Navbar button)
  useEffect(() => {
    const handleOpen = () => { setIsOpen(true); setActiveTab('rules'); };
    window.addEventListener('openRulesModal', handleOpen);
    return () => window.removeEventListener('openRulesModal', handleOpen);
  }, []);

  const accept = () => {
    localStorage.setItem('rulesAccepted', 'true');
    setIsOpen(false);
    setIsFirstVisit(false);
  };

  const close = () => {
    if (isFirstVisit) return; // Must accept on first visit
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(12px)',
            padding: '20px',
          }}
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#130b1d',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '24px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 0 120px rgba(255, 122, 26, 0.04), 0 25px 60px -12px rgba(0,0,0,0.6)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '28px 32px 0',
              textAlign: 'center',
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, rgba(255, 122, 26, 0.12), rgba(255, 163, 71, 0.06))',
                border: '1px solid rgba(255, 122, 26, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                fontSize: '24px',
              }}>
                ⚔️
              </div>
              <h2 style={{
                fontSize: '26px',
                fontWeight: 800,
                color: '#ffffff',
                marginBottom: '6px',
                letterSpacing: '-0.02em',
                fontFamily: 'Inter, sans-serif',
              }}>
                Welcome to Game Arena
              </h2>
              <p style={{
                fontSize: '14px',
                color: 'rgba(255,255,255,0.45)',
                marginBottom: '20px',
              }}>
                Read the rules and learn how each game works
              </p>

              {/* Tab Switcher */}
              <div style={{
                display: 'flex',
                gap: '4px',
                padding: '4px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <button
                  onClick={() => setActiveTab('rules')}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: '9px',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                    fontFamily: 'Inter, sans-serif',
                    background: activeTab === 'rules' ? 'rgba(255, 122, 26, 0.1)' : 'transparent',
                    color: activeTab === 'rules' ? '#ffa347' : 'rgba(255,255,255,0.4)',
                    boxShadow: activeTab === 'rules' ? '0 0 0 1px rgba(255, 122, 26,0.12)' : 'none',
                  }}
                >
                  📋 Rules & Guidelines
                </button>
                <button
                  onClick={() => setActiveTab('games')}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: '9px',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                    fontFamily: 'Inter, sans-serif',
                    background: activeTab === 'games' ? 'rgba(255, 122, 26, 0.1)' : 'transparent',
                    color: activeTab === 'games' ? '#ffa347' : 'rgba(255,255,255,0.4)',
                    boxShadow: activeTab === 'games' ? '0 0 0 1px rgba(255, 122, 26,0.12)' : 'none',
                  }}
                >
                  🎮 Game Guide
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px 32px',
            }}>
              <AnimatePresence mode="wait">
                {activeTab === 'rules' ? (
                  <motion.div
                    key="rules"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Rule Cards */}
                    {[
                      {
                        num: '01',
                        title: 'Objective',
                        icon: '🎯',
                        text: 'Your mission is simple — grow your balance as much as possible. Use the games available to climb the leaderboard. The team with the highest balance wins!',
                      },
                      {
                        num: '02',
                        title: 'Bankroll Management',
                        icon: '💰',
                        text: 'You start with a default balance. If it hits zero, your run is over unless the admin grants a bailout. Play smart — don\'t go all-in on every bet!',
                      },
                      {
                        num: '03',
                        title: 'Round Timer',
                        icon: '⏱️',
                        text: 'Games can only be played when the admin starts a round. A countdown timer appears in your header. Once the timer expires, no more bets can be placed until the next round.',
                      },
                      {
                        num: '04',
                        title: 'Fair Play',
                        icon: '🛡️',
                        text: 'All games use a Provably Fair system with cryptographic seeds. You can verify every result. No cheating, no hacking, no attacking the server.',
                      },
                      {
                        num: '05',
                        title: 'Strategy is Key',
                        icon: '🧠',
                        text: 'Some games have better odds than others. Study the payout tables, manage your risk, and know when to cash out. The best players balance aggression with discipline.',
                      },
                    ].map((rule, i) => (
                      <motion.div
                        key={rule.num}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        style={{
                          display: 'flex',
                          gap: '16px',
                          padding: '16px',
                          borderRadius: '14px',
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.05)',
                          marginBottom: '10px',
                          alignItems: 'flex-start',
                        }}
                      >
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          background: 'rgba(255, 122, 26, 0.06)',
                          border: '1px solid rgba(255, 122, 26, 0.08)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '18px',
                          flexShrink: 0,
                        }}>
                          {rule.icon}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              color: '#ffa347',
                              fontFamily: "'Space Grotesk', monospace",
                              opacity: 0.6,
                            }}>
                              {rule.num}
                            </span>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                              {rule.title}
                            </span>
                          </div>
                          <p style={{
                            fontSize: '13px',
                            color: 'rgba(255,255,255,0.5)',
                            lineHeight: 1.6,
                            margin: 0,
                          }}>
                            {rule.text}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  <motion.div
                    key="games"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {gameRules.map((game, i) => (
                      <motion.div
                        key={game.name}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        style={{
                          display: 'flex',
                          gap: '14px',
                          padding: '14px 16px',
                          borderRadius: '14px',
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.05)',
                          marginBottom: '8px',
                          alignItems: 'flex-start',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '11px',
                          background: `${game.color}12`,
                          border: `1px solid ${game.color}25`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '20px',
                          flexShrink: 0,
                        }}>
                          {game.icon}
                        </div>
                        <div style={{ flex: 1 }}>
                          <h4 style={{
                            fontSize: '14px',
                            fontWeight: 700,
                            color: game.color,
                            marginBottom: '4px',
                            fontFamily: 'Inter, sans-serif',
                          }}>
                            {game.name}
                          </h4>
                          <p style={{
                            fontSize: '12.5px',
                            color: 'rgba(255,255,255,0.48)',
                            lineHeight: 1.6,
                            margin: 0,
                          }}>
                            {game.desc}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer CTA */}
            <div style={{
              padding: '0 32px 28px',
            }}>
              <button
                onClick={isFirstVisit ? accept : close}
                style={{
                  width: '100%',
                  padding: '15px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #ff7a1a, #ffa347)',
                  color: '#2a0f00',
                  fontSize: '15px',
                  fontWeight: 800,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.2, 0, 0, 1)',
                  fontFamily: 'Inter, sans-serif',
                  letterSpacing: '-0.01em',
                  boxShadow: '0 0 0 1px rgba(255, 163, 71, 0.15) inset, 0 4px 20px rgba(255, 122, 26, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <span>⚔️</span>
                <span>{isFirstVisit ? 'I Understand — Let Me Play' : 'Got It — Close'}</span>
              </button>
              <p style={{
                textAlign: 'center',
                fontSize: '11px',
                color: 'rgba(255,255,255,0.25)',
                marginTop: '12px',
              }}>
                By clicking above, you agree to play fair and follow the rules
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
