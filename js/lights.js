/**
 * =============================================================================
 * LIGHTS MODULE (lights.js)
 * =============================================================================
 * 
 * This module orchestrates light animations for both the physical Launchpad
 * and the web UI (digital Launchpad). It uses the respective interface modules
 * to perform the actual updates.
 */

import { setWebColor, webColorMap } from './webInterface.js';
import { getLaunchpad, setPhysicalColor, getLpColor } from './physicalInterface.js';

/**
 * Registry of available animations.
 * Each animation is an object with:
 * - on: (x, y) => void (triggered on press)
 * - off: (x, y) => void (triggered on release, optional)
 * - type: 'momentary' | 'fixed' (defaults to 'fixed' if off is not provided)
 */
export const animations = {};

/**
 * Animation Factory
 * Populates the animations registry with color variants for different patterns.
 */
const createAnimationLibrary = () => {
    const colors = ['red', 'green', 'amber'];
    
    colors.forEach(colorName => {
        // 1. PULSE: Single pad on/off
        animations[`pulse_${colorName}`] = {
            on: (x, y) => {
                setWebColor(webColorMap[colorName].full, [x, y]);
                setPhysicalColor(getLpColor(colorName), [x, y]);
            },
            off: (x, y) => {
                setWebColor('off', [x, y]);
                setPhysicalColor(getLpColor('off'), [x, y]);
            },
            type: 'momentary'
        };

        // 2. CROSS: Full row and column on/off
        animations[`cross_${colorName}`] = {
            on: (x, y) => {
                const color = webColorMap[colorName].full;
                const lpColor = getLpColor(colorName);
                for (let i = 0; i < 8; i++) {
                    setWebColor(color, [i, y]);
                    setWebColor(color, [x, i]);
                    setPhysicalColor(lpColor, [i, y]);
                    setPhysicalColor(lpColor, [x, i]);
                }
            },
            off: (x, y) => {
                const lpOff = getLpColor('off');
                for (let i = 0; i < 8; i++) {
                    setWebColor('off', [i, y]);
                    setWebColor('off', [x, i]);
                    setPhysicalColor(lpOff, [i, y]);
                    setPhysicalColor(lpOff, [x, i]);
                }
            },
            type: 'momentary'
         };
 
         // 3. EXPAND: Propagating cross effect with fixed duration
         animations[`expand_${colorName}`] = {
             on: (x, y) => {
                 const applyFade = (p) => {
                     const baseColor = getLpColor(colorName);
                     const lpOff = getLpColor('off');

                     setWebColor(webColorMap[colorName].full, p);
                     setPhysicalColor(baseColor?.full, p);

                     setTimeout(() => {
                        setWebColor(webColorMap[colorName].medium, p);
                        setPhysicalColor(baseColor?.medium, p);
                     }, 100);

                     setTimeout(() => {
                        setWebColor(webColorMap[colorName].low, p);
                        setPhysicalColor(baseColor?.low, p);
                     }, 200);

                     setTimeout(() => {
                        setWebColor('off', p);
                        setPhysicalColor(lpOff, p);
                     }, 300);
                 };
                 applyFade([x, y]);
                 for (let dist = 1; dist < 8; dist++) {
                     setTimeout(() => {
                         const directions = [[x + dist, y], [x - dist, y], [x, y + dist], [x, y - dist]];
                         directions.forEach(p => {
                             if (p[0] >= 0 && p[0] < 8 && p[1] >= 0 && p[1] < 8) applyFade(p);
                         });
                     }, dist * 60);
                 }
             },
             type: 'fixed'
         };

         // 3.1 EXPAND_REVERSE: Cross effect that converges to the center
         animations[`expand_reverse_${colorName}`] = {
             on: (x, y) => {
                 const applyFade = (p) => {
                     const baseColor = getLpColor(colorName);
                     const lpOff = getLpColor('off');

                     setWebColor(webColorMap[colorName].full, p);
                     setPhysicalColor(baseColor?.full, p);

                     setTimeout(() => {
                        setWebColor(webColorMap[colorName].medium, p);
                        setPhysicalColor(baseColor?.medium, p);
                     }, 100);

                     setTimeout(() => {
                        setWebColor(webColorMap[colorName].low, p);
                        setPhysicalColor(baseColor?.low, p);
                     }, 200);

                     setTimeout(() => {
                        setWebColor('off', p);
                        setPhysicalColor(lpOff, p);
                     }, 300);
                 };

                 const maxDist = Math.max(x, 7 - x, y, 7 - y);

                 for (let dist = maxDist; dist >= 0; dist--) {
                     setTimeout(() => {
                         if (dist === 0) {
                             applyFade([x, y]);
                         } else {
                             const directions = [[x + dist, y], [x - dist, y], [x, y + dist], [x, y - dist]];
                             directions.forEach(p => {
                                 if (p[0] >= 0 && p[0] < 8 && p[1] >= 0 && p[1] < 8) applyFade(p);
                             });
                         }
                     }, (maxDist - dist) * 60);
                 }
             },
             type: 'fixed'
         };
 
         // 4. WAVE: Circular expanding wave
         animations[`wave_${colorName}`] = {
             on: (x, y) => {
                 const applyFade = (p) => {
                     const baseColor = getLpColor(colorName);
                     const lpOff = getLpColor('off');

                     setWebColor(webColorMap[colorName].full, p);
                     setPhysicalColor(baseColor?.full, p);

                     setTimeout(() => {
                        setWebColor(webColorMap[colorName].medium, p);
                        setPhysicalColor(baseColor?.medium, p);
                     }, 100);

                     setTimeout(() => {
                        setWebColor(webColorMap[colorName].low, p);
                        setPhysicalColor(baseColor?.low, p);
                     }, 200);

                     setTimeout(() => {
                        setWebColor('off', p);
                        setPhysicalColor(lpOff, p);
                     }, 300);
                 };
                 for (let targetY = 0; targetY < 8; targetY++) {
                     for (let targetX = 0; targetX < 8; targetX++) {
                         const dx = targetX - x;
                         const dy = targetY - y;
                         const distance = Math.sqrt(dx * dx + dy * dy);
                         setTimeout(() => applyFade([targetX, targetY]), distance * 60);
                     }
                 }
             },
             type: 'fixed'
          };

          // 4.1 WAVE_REVERSE: Circular wave converging to the pressed key
          animations[`wave_reverse_${colorName}`] = {
              on: (x, y) => {
                 const applyFade = (p) => {
                     const baseColor = getLpColor(colorName);
                     const lpOff = getLpColor('off');

                     setWebColor(webColorMap[colorName].full, p);
                     setPhysicalColor(baseColor?.full, p);

                     setTimeout(() => {
                        setWebColor(webColorMap[colorName].medium, p);
                        setPhysicalColor(baseColor?.medium, p);
                     }, 100);

                     setTimeout(() => {
                        setWebColor(webColorMap[colorName].low, p);
                        setPhysicalColor(baseColor?.low, p);
                     }, 200);

                     setTimeout(() => {
                        setWebColor('off', p);
                        setPhysicalColor(lpOff, p);
                     }, 300);
                 };
                  // Dynamic max distance to ensure the animation starts immediately from the furthest point
                 const maxDistance = Math.max(
                     Math.sqrt(x * x + y * y),
                     Math.sqrt(Math.pow(7 - x, 2) + y * y),
                     Math.sqrt(x * x + Math.pow(7 - y, 2)),
                     Math.sqrt(Math.pow(7 - x, 2) + Math.pow(7 - y, 2))
                 );

                 for (let targetY = 0; targetY < 8; targetY++) {
                     for (let targetX = 0; targetX < 8; targetX++) {
                         const dx = targetX - x;
                         const dy = targetY - y;
                         const distance = Math.sqrt(dx * dx + dy * dy);
                         // Delay is inverted: max distance has 0 delay
                         setTimeout(() => applyFade([targetX, targetY]), (maxDistance - distance) * 60);
                     }
                 }
              },
              type: 'fixed'
          };
  
          // 5. WAVE_CENTER: Circular expanding wave from the center
          animations[`wave_center_${colorName}`] = {
              on: () => {
                 const applyFade = (p) => {
                     const baseColor = getLpColor(colorName);
                     const lpOff = getLpColor('off');

                     setWebColor(webColorMap[colorName].full, p);
                     setPhysicalColor(baseColor?.full, p);

                     setTimeout(() => {
                        setWebColor(webColorMap[colorName].medium, p);
                        setPhysicalColor(baseColor?.medium, p);
                     }, 100);

                     setTimeout(() => {
                        setWebColor(webColorMap[colorName].low, p);
                        setPhysicalColor(baseColor?.low, p);
                     }, 200);

                     setTimeout(() => {
                        setWebColor('off', p);
                        setPhysicalColor(lpOff, p);
                     }, 300);
                 };
                  const centerX = 3.5;
                  const centerY = 3.5;
                  for (let targetY = 0; targetY < 8; targetY++) {
                      for (let targetX = 0; targetX < 8; targetX++) {
                          const dx = targetX - centerX;
                          const dy = targetY - centerY;
                          const distance = Math.sqrt(dx * dx + dy * dy);
                          setTimeout(() => applyFade([targetX, targetY]), distance * 60);
                      }
                  }
              },
              type: 'fixed'
          };

          // 5.1 WAVE_CENTER_REVERSE: Circular wave converging to the center
          animations[`wave_center_reverse_${colorName}`] = {
              on: () => {
                 const applyFade = (p) => {
                     const baseColor = getLpColor(colorName);
                     const lpOff = getLpColor('off');

                     setWebColor(webColorMap[colorName].full, p);
                     setPhysicalColor(baseColor?.full, p);

                     setTimeout(() => {
                        setWebColor(webColorMap[colorName].medium, p);
                        setPhysicalColor(baseColor?.medium, p);
                     }, 100);

                     setTimeout(() => {
                        setWebColor(webColorMap[colorName].low, p);
                        setPhysicalColor(baseColor?.low, p);
                     }, 200);

                     setTimeout(() => {
                        setWebColor('off', p);
                        setPhysicalColor(lpOff, p);
                     }, 300);
                 };
                  const centerX = 3.5;
                  const centerY = 3.5;
                  for (let targetY = 0; targetY < 8; targetY++) {
                      for (let targetX = 0; targetX < 8; targetX++) {
                          const dx = targetX - centerX;
                          const dy = targetY - centerY;
                          const distance = Math.sqrt(dx * dx + dy * dy);
                          setTimeout(() => applyFade([targetX, targetY]), (5 - distance) * 60);
                      }
                  }
              },
              type: 'fixed'
          };

          // 6. ROTATE: Rotating beam (radar sweep) with directional variants
          const rotationStarts = {
              'top': -Math.PI / 2,
              'right': 0,
              'bottom': Math.PI / 2,
              'left': Math.PI
          };

          Object.entries(rotationStarts).forEach(([dirName, startAngle]) => {
              // Clockwise (CW)
              animations[`rotate_cw_${dirName}_${colorName}`] = {
                  on: () => {
                      const centerX = 3.5;
                      const centerY = 3.5;
                      const baseColor = getLpColor(colorName);
                      const lpOff = getLpColor('off');
                      
                      for (let targetY = 0; targetY < 8; targetY++) {
                          for (let targetX = 0; targetX < 8; targetX++) {
                              const dx = targetX - centerX;
                              const dy = targetY - centerY;
                              const angle = Math.atan2(dy, dx);
                              
                              // Calculate normalized angle (0 to 1) starting from startAngle, going CW
                              let shiftedAngle = angle - startAngle;
                              while (shiftedAngle < 0) shiftedAngle += 2 * Math.PI;
                              const normalizedAngle = shiftedAngle / (2 * Math.PI);
                              
                              const delay = normalizedAngle * 600;
                              const p = [targetX, targetY];
                              setTimeout(() => {
                                  setWebColor(webColorMap[colorName].full, p);
                                  setPhysicalColor(baseColor?.full, p);

                                  setTimeout(() => {
                                      setWebColor(webColorMap[colorName].medium, p);
                                      setPhysicalColor(baseColor?.medium, p);
                                  }, 100);

                                  setTimeout(() => {
                                      setWebColor(webColorMap[colorName].low, p);
                                      setPhysicalColor(baseColor?.low, p);
                                  }, 200);

                                  setTimeout(() => {
                                      setWebColor('off', p);
                                      setPhysicalColor(lpOff, p);
                                  }, 300);
                              }, delay);
                          }
                      }
                  },
                  type: 'fixed'
              };

              // Counter-Clockwise (CCW)
              animations[`rotate_ccw_${dirName}_${colorName}`] = {
                  on: () => {
                      const centerX = 3.5;
                      const centerY = 3.5;
                      const baseColor = getLpColor(colorName);
                      const lpOff = getLpColor('off');
                      
                      for (let targetY = 0; targetY < 8; targetY++) {
                          for (let targetX = 0; targetX < 8; targetX++) {
                              const dx = targetX - centerX;
                              const dy = targetY - centerY;
                              const angle = Math.atan2(dy, dx);
                              
                              // Calculate normalized angle (0 to 1) starting from startAngle, going CCW
                              let shiftedAngle = startAngle - angle;
                              while (shiftedAngle < 0) shiftedAngle += 2 * Math.PI;
                              const normalizedAngle = shiftedAngle / (2 * Math.PI);
                              
                              const delay = normalizedAngle * 600;
                              const p = [targetX, targetY];
                              setTimeout(() => {
                                  setWebColor(webColorMap[colorName].full, p);
                                  setPhysicalColor(baseColor?.full, p);

                                  setTimeout(() => {
                                      setWebColor(webColorMap[colorName].medium, p);
                                      setPhysicalColor(baseColor?.medium, p);
                                  }, 100);

                                  setTimeout(() => {
                                      setWebColor(webColorMap[colorName].low, p);
                                      setPhysicalColor(baseColor?.low, p);
                                  }, 200);

                                  setTimeout(() => {
                                      setWebColor('off', p);
                                      setPhysicalColor(lpOff, p);
                                  }, 300);
                              }, delay);
                          }
                      }
                  },
                  type: 'fixed'
              };
          });

          // 7. DIAGONAL: Straight diagonal wave from corners
          const corners = {
              'top_left': (x, y) => x + y,
              'top_right': (x, y) => (7 - x) + y,
              'bottom_left': (x, y) => x + (7 - y),
              'bottom_right': (x, y) => (7 - x) + (7 - y)
          };

          Object.entries(corners).forEach(([cornerName, distFn]) => {
              // Normal
              animations[`diagonal_${cornerName}_${colorName}`] = {
                  on: () => {
                      const applyFade = (p) => {
                          const baseColor = getLpColor(colorName);
                          const lpOff = getLpColor('off');

                          setWebColor(webColorMap[colorName].full, p);
                          setPhysicalColor(baseColor?.full, p);

                          setTimeout(() => {
                              setWebColor(webColorMap[cornerName]?.medium || webColorMap[colorName].medium, p);
                              setPhysicalColor(baseColor?.medium, p);
                          }, 100);

                          setTimeout(() => {
                              setWebColor(webColorMap[cornerName]?.low || webColorMap[colorName].low, p);
                              setPhysicalColor(baseColor?.low, p);
                          }, 200);

                          setTimeout(() => {
                              setWebColor('off', p);
                              setPhysicalColor(lpOff, p);
                          }, 300);
                      };
                      for (let targetY = 0; targetY < 8; targetY++) {
                          for (let targetX = 0; targetX < 8; targetX++) {
                              const distance = distFn(targetX, targetY);
                              setTimeout(() => applyFade([targetX, targetY]), distance * 60);
                          }
                      }
                  },
                  type: 'fixed'
              };
          });

          // 8. RING: Expanding shockwave (only the edge)
          animations[`ring_${colorName}`] = {
              on: (x, y) => {
                  const applyFadeShort = (p) => {
                      const baseColor = getLpColor(colorName);
                      const lpOff = getLpColor('off');
                      setWebColor(webColorMap[colorName].full, p);
                      setPhysicalColor(baseColor?.full, p);
                      setTimeout(() => {
                          setWebColor(webColorMap[colorName].low, p);
                          setPhysicalColor(baseColor?.low, p);
                      }, 70);
                      setTimeout(() => {
                          setWebColor('off', p);
                          setPhysicalColor(lpOff, p);
                      }, 140);
                  };
                  for (let targetY = 0; targetY < 8; targetY++) {
                      for (let targetX = 0; targetX < 8; targetX++) {
                          const dx = targetX - x;
                          const dy = targetY - y;
                          const distance = Math.sqrt(dx * dx + dy * dy);
                          setTimeout(() => applyFadeShort([targetX, targetY]), distance * 60);
                      }
                  }
              },
              type: 'fixed'
          };

          // 8b. RING_CENTER: Expanding shockwave from the center
          animations[`ring_center_${colorName}`] = {
              on: () => {
                  const cx = 3.5, cy = 3.5; // Center of the 8x8 grid
                  const applyFadeShort = (p) => {
                      const baseColor = getLpColor(colorName);
                      const lpOff = getLpColor('off');
                      setWebColor(webColorMap[colorName].full, p);
                      setPhysicalColor(baseColor?.full, p);
                      setTimeout(() => {
                          setWebColor(webColorMap[colorName].low, p);
                          setPhysicalColor(baseColor?.low, p);
                      }, 70);
                      setTimeout(() => {
                          setWebColor('off', p);
                          setPhysicalColor(lpOff, p);
                      }, 140);
                  };
                  for (let targetY = 0; targetY < 8; targetY++) {
                      for (let targetX = 0; targetX < 8; targetX++) {
                          const dx = targetX - cx;
                          const dy = targetY - cy;
                          const distance = Math.sqrt(dx * dx + dy * dy);
                          setTimeout(() => applyFadeShort([targetX, targetY]), distance * 60);
                      }
                  }
              },
              type: 'fixed'
          };

          animations[`ring_reverse_${colorName}`] = {
              on: (x, y) => {
                  const applyFadeShort = (p) => {
                      const baseColor = getLpColor(colorName);
                      const lpOff = getLpColor('off');
                      setWebColor(webColorMap[colorName].full, p);
                      setPhysicalColor(baseColor?.full, p);
                      setTimeout(() => {
                          setWebColor(webColorMap[colorName].low, p);
                          setPhysicalColor(baseColor?.low, p);
                      }, 70);
                      setTimeout(() => {
                          setWebColor('off', p);
                          setPhysicalColor(lpOff, p);
                      }, 140);
                  };
                  const maxDistance = Math.max(
                      Math.sqrt(x * x + y * y),
                      Math.sqrt(Math.pow(7 - x, 2) + y * y),
                      Math.sqrt(x * x + Math.pow(7 - y, 2)),
                      Math.sqrt(Math.pow(7 - x, 2) + Math.pow(7 - y, 2))
                  );
                  for (let targetY = 0; targetY < 8; targetY++) {
                      for (let targetX = 0; targetX < 8; targetX++) {
                          const dx = targetX - x;
                          const dy = targetY - y;
                          const distance = Math.sqrt(dx * dx + dy * dy);
                          setTimeout(() => applyFadeShort([targetX, targetY]), (maxDistance - distance) * 60);
                      }
                  }
              },
              type: 'fixed'
          };

          // 9. SCANLINE: Full grid sweeps
          animations[`scan_h_${colorName}`] = {
              on: (x, y) => {
                  for (let ty = 0; ty < 8; ty++) {
                      const delay = Math.abs(ty - y) * 60;
                      setTimeout(() => {
                          for (let tx = 0; tx < 8; tx++) {
                              const baseColor = getLpColor(colorName);
                              const lpOff = getLpColor('off');
                              const p = [tx, ty];
                              setWebColor(webColorMap[colorName].full, p);
                              setPhysicalColor(baseColor?.full, p);
                              setTimeout(() => { setWebColor('off', p); setPhysicalColor(lpOff, p); }, 150);
                          }
                      }, delay);
                  }
              },
              type: 'fixed'
          };

          animations[`scan_v_${colorName}`] = {
              on: (x, y) => {
                  for (let tx = 0; tx < 8; tx++) {
                      const delay = Math.abs(tx - x) * 60;
                      setTimeout(() => {
                          for (let ty = 0; ty < 8; ty++) {
                              const baseColor = getLpColor(colorName);
                              const lpOff = getLpColor('off');
                              const p = [tx, ty];
                              setWebColor(webColorMap[colorName].full, p);
                              setPhysicalColor(baseColor?.full, p);
                              setTimeout(() => { setWebColor('off', p); setPhysicalColor(lpOff, p); }, 150);
                          }
                      }, delay);
                  }
              },
              type: 'fixed'
          };

          // 10. RAIN: Falling pixel sequence
          animations[`rain_${colorName}`] = {
              on: (x, y) => {
                  const applyFadeShort = (p) => {
                      const baseColor = getLpColor(colorName);
                      const lpOff = getLpColor('off');
                      setWebColor(webColorMap[colorName].full, p);
                      setPhysicalColor(baseColor?.full, p);
                      setTimeout(() => { setWebColor('off', p); setPhysicalColor(lpOff, p); }, 150);
                  };
                  for (let ty = y; ty < 8; ty++) {
                      const delay = (ty - y) * 100;
                      setTimeout(() => applyFadeShort([x, ty]), delay);
                  }
              },
              type: 'fixed'
          };

          // 10b. MATRIX_RAIN: Global falling rain on all columns
          animations[`matrix_rain_${colorName}`] = {
              on: () => {
                  const applyFadeShort = (p) => {
                      const baseColor = getLpColor(colorName);
                      const lpOff = getLpColor('off');
                      setWebColor(webColorMap[colorName].full, p);
                      setPhysicalColor(baseColor?.full, p);
                      setTimeout(() => { setWebColor('off', p); setPhysicalColor(lpOff, p); }, 150);
                  };
                  for (let tx = 0; tx < 8; tx++) {
                      const startDelay = Math.random() * 500;
                      const speed = 70 + Math.random() * 50;
                      setTimeout(() => {
                          for (let ty = 0; ty < 8; ty++) {
                              const stepDelay = ty * speed;
                              setTimeout(() => applyFadeShort([tx, ty]), stepDelay);
                          }
                      }, startDelay);
                  }
              },
              type: 'fixed'
          };

          animations[`rain_up_${colorName}`] = {
              on: (x, y) => {
                  const applyFadeShort = (p) => {
                      const baseColor = getLpColor(colorName);
                      const lpOff = getLpColor('off');
                      setWebColor(webColorMap[colorName].full, p);
                      setPhysicalColor(baseColor?.full, p);
                      setTimeout(() => { setWebColor('off', p); setPhysicalColor(lpOff, p); }, 200);
                  };
                  for (let ty = y; ty >= 0; ty--) {
                      const delay = (y - ty) * 80;
                      setTimeout(() => applyFadeShort([x, ty]), delay);
                  }
              },
              type: 'fixed'
          };

          // 11. VORTEX: Eliminato su richiesta utente

          // 12. SPARKLE: Random pixels across the entire grid
          animations[`sparkle_${colorName}`] = {
              on: () => {
                  const applyFadeShort = (p) => {
                      const baseColor = getLpColor(colorName);
                      const lpOff = getLpColor('off');
                      setWebColor(webColorMap[colorName].full, p);
                      setPhysicalColor(baseColor?.full, p);
                      setTimeout(() => { setWebColor('off', p); setPhysicalColor(lpOff, p); }, 150);
                  };
                  for (let i = 0; i < 20; i++) {
                      const delay = Math.random() * 600;
                      const tx = Math.floor(Math.random() * 8);
                      const ty = Math.floor(Math.random() * 8);
                      setTimeout(() => applyFadeShort([tx, ty]), delay);
                  }
              },
              type: 'fixed'
          };

          // 13. BOUNCE: Four pulses moving to edges and back
          animations[`bounce_${colorName}`] = {
              on: (x, y) => {
                  const applyFadeShort = (p) => {
                      const baseColor = getLpColor(colorName);
                      const lpOff = getLpColor('off');
                      setWebColor(webColorMap[colorName].full, p);
                      setPhysicalColor(baseColor?.full, p);
                      setTimeout(() => { setWebColor('off', p); setPhysicalColor(lpOff, p); }, 100);
                  };
                  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
                  directions.forEach(([dx, dy]) => {
                      for (let step = 0; step < 8; step++) {
                          const tx = x + dx * step;
                          const ty = y + dy * step;
                          if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) {
                              setTimeout(() => applyFadeShort([tx, ty]), step * 50);
                          } else {
                              // Bounce back logic: simplified as a reverse sweep
                              const lastValidStep = step - 1;
                              for (let bStep = 1; bStep <= lastValidStep; bStep++) {
                                  const bx = x + dx * (lastValidStep - bStep);
                                  const by = y + dy * (lastValidStep - bStep);
                                  setTimeout(() => applyFadeShort([bx, by]), (step + bStep) * 50);
                              }
                              break;
                          }
                      }
                  });
              },
              type: 'fixed'
          };

          // 14. SNAKE: Square spiral expansion from center
          animations[`snake_${colorName}`] = {
              on: () => {
                  const applyFadeShort = (p) => {
                      const baseColor = getLpColor(colorName);
                      const lpOff = getLpColor('off');
                      setWebColor(webColorMap[colorName].full, p);
                      setPhysicalColor(baseColor?.full, p);
                      setTimeout(() => { setWebColor('off', p); setPhysicalColor(lpOff, p); }, 150);
                  };
                  let tx = 3, ty = 3; // Starting near center
                  let delay = 0;
                  applyFadeShort([tx, ty]);
                  
                  const move = (dx, dy, steps) => {
                      for (let i = 0; i < steps; i++) {
                          tx += dx;
                          ty += dy;
                          if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) {
                              const p = [tx, ty];
                              delay += 30;
                              setTimeout(() => applyFadeShort(p), delay);
                          }
                      }
                  };

                  for (let s = 1; s < 8; s++) {
                      move(1, 0, s);  // Right
                      move(0, 1, s);  // Down
                      s++;
                      move(-1, 0, s); // Left
                      move(0, -1, s); // Up
                  }
              },
              type: 'fixed'
          };

          // 15. DNA_HELIX: Eliminata su richiesta utente

          // 16. WARP_SPEED: Explosion from center to corners
          animations[`warp_speed_${colorName}`] = {
              on: () => {
                  const applyFadeShort = (p) => {
                      const baseColor = getLpColor(colorName);
                      const lpOff = getLpColor('off');
                      setWebColor(webColorMap[colorName].full, p);
                      setPhysicalColor(baseColor?.full, p);
                      setTimeout(() => { setWebColor('off', p); setPhysicalColor(lpOff, p); }, 150);
                  };
                  const centers = [[3, 3], [3, 4], [4, 3], [4, 4]];
                  const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
                  centers.forEach((c, i) => {
                      const [dx, dy] = directions[i];
                      for (let step = 0; step < 4; step++) {
                          const tx = c[0] + dx * step;
                          const ty = c[1] + dy * step;
                          setTimeout(() => applyFadeShort([tx, ty]), step * 80);
                      }
                  });
              },
              type: 'fixed'
          };

          // 17. SNAKE_COLLISION: Two snakes colliding at center
          animations[`snake_collision_${colorName}`] = {
              on: () => {
                  const applyFadeShort = (p) => {
                      const baseColor = getLpColor(colorName);
                      const lpOff = getLpColor('off');
                      setWebColor(webColorMap[colorName].full, p);
                      setPhysicalColor(baseColor?.full, p);
                      setTimeout(() => { setWebColor('off', p); setPhysicalColor(lpOff, p); }, 150);
                  };
                  const path1 = [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3]];
                  const path2 = [[7, 7], [6, 7], [5, 7], [4, 7], [4, 6], [4, 5], [4, 4]];
                  path1.forEach((p, i) => {
                      setTimeout(() => applyFadeShort(p), i * 100);
                  });
                  path2.forEach((p, i) => {
                      setTimeout(() => applyFadeShort(p), i * 100);
                  });
                  // Collision flash
                  setTimeout(() => {
                      const flash = [[3, 3], [3, 4], [4, 3], [4, 4]];
                      flash.forEach(p => applyFadeShort(p));
                  }, path1.length * 100);
              },
              type: 'fixed'
          };

          // 18. EQ_SPECTRUM: Columns jump to random heights
          animations[`eq_spectrum_${colorName}`] = {
              on: () => {
                  const applyFadeShort = (p) => {
                      const baseColor = getLpColor(colorName);
                      const lpOff = getLpColor('off');
                      setWebColor(webColorMap[colorName].full, p);
                      setPhysicalColor(baseColor?.full, p);
                      setTimeout(() => { setWebColor('off', p); setPhysicalColor(lpOff, p); }, 150);
                  };
                  for (let tx = 0; tx < 8; tx++) {
                      const height = Math.floor(Math.random() * 7) + 1;
                      for (let ty = 7; ty >= 8 - height; ty--) {
                          setTimeout(() => applyFadeShort([tx, ty]), (7 - ty) * 40);
                      }
                  }
              },
              type: 'fixed'
          };

          // 19. STROBE_BURST: Rapid grid flashes
          animations[`strobe_burst_${colorName}`] = {
              on: () => {
                  const baseColor = getLpColor(colorName);
                  const lpOff = getLpColor('off');
                  for (let flash = 0; flash < 4; flash++) {
                      setTimeout(() => {
                          // Flash On
                          for (let ty = 0; ty < 8; ty++) {
                              for (let tx = 0; tx < 8; tx++) {
                                  setWebColor(webColorMap[colorName].full, [tx, ty]);
                                  setPhysicalColor(baseColor?.full, [tx, ty]);
                              }
                          }
                          // Flash Off
                          setTimeout(() => {
                              for (let ty = 0; ty < 8; ty++) {
                                  for (let tx = 0; tx < 8; tx++) {
                                      setWebColor('off', [tx, ty]);
                                      setPhysicalColor(lpOff, [tx, ty]);
                                  }
                              }
                          }, 50);
                      }, flash * 120);
                  }
              },
              type: 'fixed'
          };

          // 20. EQ_BOUNCE: Solid columns that rise and fall
          animations[`eq_bounce_${colorName}`] = {
              on: () => {
                  const baseColor = getLpColor(colorName);
                  const lpOff = getLpColor('off');
                  for (let tx = 0; tx < 8; tx++) {
                      const height = Math.floor(Math.random() * 7) + 1;
                      const peakRow = 8 - height;
                      const speed = 40;
                      const hold = 100;

                      // Rise: Turn pixels ON from bottom to top
                      for (let ty = 7; ty >= peakRow; ty--) {
                          setTimeout(() => {
                              setWebColor(webColorMap[colorName].full, [tx, ty]);
                              setPhysicalColor(baseColor?.full, [tx, ty]);
                          }, (7 - ty) * speed);
                      }

                      // Fall: Turn pixels OFF from top to bottom
                      for (let ty = peakRow; ty <= 7; ty++) {
                          const fallDelay = (7 - peakRow) * speed + hold + (ty - peakRow) * speed;
                          setTimeout(() => {
                              setWebColor('off', [tx, ty]);
                              setPhysicalColor(lpOff, [tx, ty]);
                          }, fallDelay);
                      }
                  }
              },
              type: 'fixed'
          };

          // 21. EQ_PEAK_HOLD: Columns fall immediately, but the peak pixel stays longer
          animations[`eq_peak_hold_${colorName}`] = {
              on: () => {
                  const baseColor = getLpColor(colorName);
                  const lpOff = getLpColor('off');
                  for (let tx = 0; tx < 8; tx++) {
                      const height = Math.floor(Math.random() * 7) + 1;
                      const peakRow = 8 - height;
                      const speed = 30;
                      const peakHold = 400;

                      // Rise
                      for (let ty = 7; ty >= peakRow; ty--) {
                          setTimeout(() => {
                              setWebColor(webColorMap[colorName].full, [tx, ty]);
                              setPhysicalColor(baseColor?.full, [tx, ty]);
                          }, (7 - ty) * speed);
                      }

                      // Fast Fall (all except peak)
                      for (let ty = peakRow + 1; ty <= 7; ty++) {
                          const fallDelay = (7 - peakRow) * speed + (ty - peakRow) * speed;
                          setTimeout(() => {
                              setWebColor('off', [tx, ty]);
                              setPhysicalColor(lpOff, [tx, ty]);
                          }, fallDelay);
                      }

                      // Peak Fall (stays longer)
                      const peakFallDelay = (7 - peakRow) * speed + peakHold;
                      setTimeout(() => {
                          setWebColor('off', [tx, peakRow]);
                          setPhysicalColor(lpOff, [tx, peakRow]);
                      }, peakFallDelay);
                  }
              },
              type: 'fixed'
          };

          // Legacy / Default aliases (Left-starting)
          animations[`rotate_cw_${colorName}`] = animations[`rotate_cw_left_${colorName}`];
          animations[`rotate_ccw_${colorName}`] = animations[`rotate_ccw_left_${colorName}`];
      });

      // 8. CROSS_MULTI: Color transitioning cross (Red -> Amber -> Green and vice-versa)
      const multiColorConfigs = [
          { 
              name: 'red_to_green', 
              sequence: [
                  { color: 'red', level: 'full' },
                  { color: 'amber', level: 'low' },
                  { color: 'green', level: 'low' }
              ] 
          },
          { 
              name: 'green_to_red', 
              sequence: [
                  { color: 'green', level: 'full' },
                  { color: 'amber', level: 'low' },
                  { color: 'red', level: 'low' }
              ] 
          }
      ];

      multiColorConfigs.forEach(config => {
          // HELPER: applyMultiFade
          const applyMultiFade = (p) => {
              const step1 = config.sequence[0];
              const step2 = config.sequence[1];
              const step3 = config.sequence[2];
              const lpOff = getLpColor('off');

              // Step 1
              setWebColor(webColorMap[step1.color][step1.level], p);
              setPhysicalColor(getLpColor(step1.color, step1.level), p);

              // Step 2
              setTimeout(() => {
                  setWebColor(webColorMap[step2.color][step2.level], p);
                  setPhysicalColor(getLpColor(step2.color, step2.level), p);
              }, 150);

              // Step 3
              setTimeout(() => {
                  setWebColor(webColorMap[step3.color][step3.level], p);
                  setPhysicalColor(getLpColor(step3.color, step3.level), p);
              }, 300);

              // Off
              setTimeout(() => {
                  setWebColor('off', p);
                  setPhysicalColor(lpOff, p);
              }, 450);
          };

          // 8. CROSS_MULTI: Color transitioning cross
          animations[`cross_multi_${config.name}`] = {
              on: (x, y) => {
                  applyMultiFade([x, y]);
                  for (let dist = 1; dist < 8; dist++) {
                      setTimeout(() => {
                          const directions = [[x + dist, y], [x - dist, y], [x, y + dist], [x, y - dist]];
                          directions.forEach(p => {
                              if (p[0] >= 0 && p[0] < 8 && p[1] >= 0 && p[1] < 8) applyMultiFade(p);
                          });
                      }, dist * 70);
                  }
              },
              type: 'fixed'
          };

          // 8.1 CROSS_MULTI_REVERSE: Color transitioning cross converging to center
          animations[`cross_multi_reverse_${config.name}`] = {
              on: (x, y) => {
                  const maxDist = Math.max(x, 7 - x, y, 7 - y);
                  for (let dist = maxDist; dist >= 0; dist--) {
                      setTimeout(() => {
                          if (dist === 0) {
                              applyMultiFade([x, y]);
                          } else {
                              const directions = [[x + dist, y], [x - dist, y], [x, y + dist], [x, y - dist]];
                              directions.forEach(p => {
                                  if (p[0] >= 0 && p[0] < 8 && p[1] >= 0 && p[1] < 8) applyMultiFade(p);
                              });
                          }
                      }, (maxDist - dist) * 70);
                  }
              },
              type: 'fixed'
          };

          // 9. EXPAND_MULTI: Color transitioning expand
          animations[`expand_multi_${config.name}`] = animations[`cross_multi_${config.name}`];
          animations[`expand_multi_reverse_${config.name}`] = animations[`cross_multi_reverse_${config.name}`];

          // 10. WAVE_MULTI: Color transitioning wave
          animations[`wave_multi_${config.name}`] = {
              on: (x, y) => {
                  for (let targetY = 0; targetY < 8; targetY++) {
                      for (let targetX = 0; targetX < 8; targetX++) {
                          const dx = targetX - x;
                          const dy = targetY - y;
                          const distance = Math.sqrt(dx * dx + dy * dy);
                          setTimeout(() => applyMultiFade([targetX, targetY]), distance * 60);
                      }
                  }
              },
              type: 'fixed'
          };

          // 10.1 WAVE_MULTI_REVERSE: Color transitioning wave converging to pressed key
          animations[`wave_multi_reverse_${config.name}`] = {
              on: (x, y) => {
                  const maxDistance = Math.max(
                      Math.sqrt(x * x + y * y),
                      Math.sqrt(Math.pow(7 - x, 2) + y * y),
                      Math.sqrt(x * x + Math.pow(7 - y, 2)),
                      Math.sqrt(Math.pow(7 - x, 2) + Math.pow(7 - y, 2))
                  );

                  for (let targetY = 0; targetY < 8; targetY++) {
                      for (let targetX = 0; targetX < 8; targetX++) {
                          const dx = targetX - x;
                          const dy = targetY - y;
                          const distance = Math.sqrt(dx * dx + dy * dy);
                          setTimeout(() => applyMultiFade([targetX, targetY]), (maxDistance - distance) * 60);
                      }
                  }
              },
              type: 'fixed'
          };

          // 11. WAVE_CENTER_MULTI: Color transitioning wave from center
          animations[`wave_center_multi_${config.name}`] = {
              on: () => {
                  const centerX = 3.5;
                  const centerY = 3.5;
                  for (let targetY = 0; targetY < 8; targetY++) {
                      for (let targetX = 0; targetX < 8; targetX++) {
                          const dx = targetX - centerX;
                          const dy = targetY - centerY;
                          const distance = Math.sqrt(dx * dx + dy * dy);
                          setTimeout(() => applyMultiFade([targetX, targetY]), distance * 60);
                      }
                  }
              },
              type: 'fixed'
          };

          // 11.1 WAVE_CENTER_MULTI_REVERSE: Color transitioning wave converging to center
          animations[`wave_center_multi_reverse_${config.name}`] = {
              on: () => {
                  const centerX = 3.5;
                  const centerY = 3.5;
                  for (let targetY = 0; targetY < 8; targetY++) {
                      for (let targetX = 0; targetX < 8; targetX++) {
                          const dx = targetX - centerX;
                          const dy = targetY - centerY;
                          const distance = Math.sqrt(dx * dx + dy * dy);
                          setTimeout(() => applyMultiFade([targetX, targetY]), (5 - distance) * 60);
                      }
                  }
              },
              type: 'fixed'
          };

          // 11.2 DIAGONAL_MULTI: Color transitioning diagonal wave
          const corners = {
              'top_left': (x, y) => x + y,
              'top_right': (x, y) => (7 - x) + y,
              'bottom_left': (x, y) => x + (7 - y),
              'bottom_right': (x, y) => (7 - x) + (7 - y)
          };

          Object.entries(corners).forEach(([cornerName, distFn]) => {
              // Normal
              animations[`diagonal_multi_${cornerName}_${config.name}`] = {
                  on: () => {
                      for (let targetY = 0; targetY < 8; targetY++) {
                          for (let targetX = 0; targetX < 8; targetX++) {
                              const distance = distFn(targetX, targetY);
                              setTimeout(() => applyMultiFade([targetX, targetY]), distance * 60);
                          }
                      }
                  },
                  type: 'fixed'
              };
          });

          // 12. ROTATE_MULTI: Color transitioning rotation
          const rotationStarts = { 'top': -Math.PI / 2, 'right': 0, 'bottom': Math.PI / 2, 'left': Math.PI };
          Object.entries(rotationStarts).forEach(([dirName, startAngle]) => {
              // CW
              animations[`rotate_cw_${dirName}_multi_${config.name}`] = {
                  on: () => {
                      for (let targetY = 0; targetY < 8; targetY++) {
                          for (let targetX = 0; targetX < 8; targetX++) {
                              const dx = targetX - 3.5;
                              const dy = targetY - 3.5;
                              const angle = Math.atan2(dy, dx);
                              let shiftedAngle = angle - startAngle;
                              while (shiftedAngle < 0) shiftedAngle += 2 * Math.PI;
                              const normalizedAngle = shiftedAngle / (2 * Math.PI);
                              setTimeout(() => applyMultiFade([targetX, targetY]), normalizedAngle * 600);
                          }
                      }
                  },
                  type: 'fixed'
              };
              // CCW
              animations[`rotate_ccw_${dirName}_multi_${config.name}`] = {
                  on: () => {
                      for (let targetY = 0; targetY < 8; targetY++) {
                          for (let targetX = 0; targetX < 8; targetX++) {
                              const dx = targetX - 3.5;
                              const dy = targetY - 3.5;
                              const angle = Math.atan2(dy, dx);
                              let shiftedAngle = startAngle - angle;
                              while (shiftedAngle < 0) shiftedAngle += 2 * Math.PI;
                              const normalizedAngle = shiftedAngle / (2 * Math.PI);
                              setTimeout(() => applyMultiFade([targetX, targetY]), normalizedAngle * 600);
                          }
                      }
                  },
                  type: 'fixed'
              };
          });

          // 13. RING_MULTI: Expanding shockwave from the center (multi-color)
          animations[`ring_center_multi_${config.name}`] = {
              on: () => {
                  const cx = 3.5, cy = 3.5;
                  for (let ty = 0; ty < 8; ty++) {
                      for (let tx = 0; tx < 8; tx++) {
                          const dist = Math.sqrt(Math.pow(tx - cx, 2) + Math.pow(ty - cy, 2));
                          const delay = dist * 70;
                          setTimeout(() => applyMultiFade([tx, ty]), delay);
                      }
                  }
              },
              type: 'fixed'
          };

          // 14. SCANLINE_MULTI: Multi-color grid sweeps
          animations[`scan_h_multi_${config.name}`] = {
              on: (x, y) => {
                  for (let ty = 0; ty < 8; ty++) {
                      const delay = Math.abs(ty - y) * 70;
                      setTimeout(() => {
                          for (let tx = 0; tx < 8; tx++) {
                              applyMultiFade([tx, ty]);
                          }
                      }, delay);
                  }
              },
              type: 'fixed'
          };

          animations[`scan_v_multi_${config.name}`] = {
              on: (x, y) => {
                  for (let tx = 0; tx < 8; tx++) {
                      const delay = Math.abs(tx - x) * 70;
                      setTimeout(() => {
                          for (let ty = 0; ty < 8; ty++) {
                              applyMultiFade([tx, ty]);
                          }
                      }, delay);
                  }
              },
              type: 'fixed'
          };

          // 15. RAIN_MULTI: Multi-color falling pixels
          animations[`rain_multi_${config.name}`] = {
              on: (x, y) => {
                  for (let ty = y; ty < 8; ty++) {
                      const delay = (ty - y) * 100;
                      setTimeout(() => applyMultiFade([x, ty]), delay);
                  }
              },
              type: 'fixed'
          };

          animations[`rain_multi_up_${config.name}`] = {
              on: (x, y) => {
                  for (let ty = y; ty >= 0; ty--) {
                      const delay = (y - ty) * 100;
                      setTimeout(() => applyMultiFade([x, ty]), delay);
                  }
              },
              type: 'fixed'
          };

          // 15b. MATRIX_RAIN_MULTI: Global falling rain on all columns
          animations[`matrix_rain_multi_${config.name}`] = {
              on: () => {
                  for (let tx = 0; tx < 8; tx++) {
                      const startDelay = Math.random() * 400;
                      const speed = 80 + Math.random() * 60;
                      setTimeout(() => {
                          for (let ty = 0; ty < 8; ty++) {
                              const stepDelay = ty * speed;
                              setTimeout(() => applyMultiFade([tx, ty]), stepDelay);
                          }
                      }, startDelay);
                  }
              },
              type: 'fixed'
          };

          // 16. SPARKLE_MULTI: Multi-color random pixels across the grid
          animations[`sparkle_multi_${config.name}`] = {
              on: () => {
                  for (let i = 0; i < 20; i++) {
                      const delay = Math.random() * 800;
                      const tx = Math.floor(Math.random() * 8);
                      const ty = Math.floor(Math.random() * 8);
                      setTimeout(() => applyMultiFade([tx, ty]), delay);
                  }
              },
              type: 'fixed'
          };

          // 17. BOUNCE_MULTI: Multi-color border bounce
          animations[`bounce_multi_${config.name}`] = {
              on: (x, y) => {
                  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
                  directions.forEach(([dx, dy]) => {
                      for (let step = 0; step < 8; step++) {
                          const tx = x + dx * step;
                          const ty = y + dy * step;
                          if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) {
                              setTimeout(() => applyMultiFade([tx, ty]), step * 60);
                          } else {
                              const lastValidStep = step - 1;
                              for (let bStep = 1; bStep <= lastValidStep; bStep++) {
                                  const bx = x + dx * (lastValidStep - bStep);
                                  const by = y + dy * (lastValidStep - bStep);
                                  setTimeout(() => applyMultiFade([bx, by]), (step + bStep) * 60);
                              }
                              break;
                          }
                      }
                  });
              },
              type: 'fixed'
          };

          // 18. SNAKE_MULTI: Multi-color square spiral from center
          animations[`snake_multi_${config.name}`] = {
              on: () => {
                  let tx = 3, ty = 3;
                  let delay = 0;
                  applyMultiFade([tx, ty]);
                  
                  const move = (dx, dy, steps) => {
                      for (let i = 0; i < steps; i++) {
                          tx += dx;
                          ty += dy;
                          if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) {
                              const p = [tx, ty];
                              delay += 40;
                              setTimeout(() => applyMultiFade(p), delay);
                          }
                      }
                  };

                  for (let s = 1; s < 8; s++) {
                      move(1, 0, s);
                      move(0, 1, s);
                      s++;
                      move(-1, 0, s);
                      move(0, -1, s);
                  }
              },
              type: 'fixed'
          };

          // 19. DNA_HELIX_MULTI: Eliminata su richiesta utente

          // 20. WARP_SPEED_MULTI: Explosion from center to corners
          animations[`warp_speed_multi_${config.name}`] = {
              on: () => {
                  const centers = [[3, 3], [3, 4], [4, 3], [4, 4]];
                  const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
                  centers.forEach((c, i) => {
                      const [dx, dy] = directions[i];
                      for (let step = 0; step < 4; step++) {
                          const tx = c[0] + dx * step;
                          const ty = c[1] + dy * step;
                          setTimeout(() => applyMultiFade([tx, ty]), step * 80);
                      }
                  });
              },
              type: 'fixed'
          };

          // 21. SNAKE_COLLISION_MULTI: Two snakes colliding at center
          animations[`snake_collision_multi_${config.name}`] = {
              on: () => {
                  const path1 = [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3]];
                  const path2 = [[7, 7], [6, 7], [5, 7], [4, 7], [4, 6], [4, 5], [4, 4]];
                  path1.forEach((p, i) => {
                      setTimeout(() => applyMultiFade(p), i * 100);
                  });
                  path2.forEach((p, i) => {
                      setTimeout(() => applyMultiFade(p), i * 100);
                  });
                  // Collision flash
                  setTimeout(() => {
                      const flash = [[3, 3], [3, 4], [4, 3], [4, 4]];
                      flash.forEach(p => applyMultiFade(p));
                  }, path1.length * 100);
              },
              type: 'fixed'
          };

          // 22. EQ_SPECTRUM_MULTI: Columns jump to random heights
          animations[`eq_spectrum_multi_${config.name}`] = {
              on: () => {
                  for (let tx = 0; tx < 8; tx++) {
                      const height = Math.floor(Math.random() * 7) + 1;
                      for (let ty = 7; ty >= 8 - height; ty--) {
                          setTimeout(() => applyMultiFade([tx, ty]), (7 - ty) * 40);
                      }
                  }
              },
              type: 'fixed'
          };

          // 23. STROBE_BURST_MULTI: Rapid grid flashes with color transition
          animations[`strobe_burst_multi_${config.name}`] = {
              on: () => {
                  const lpOff = getLpColor('off');
                  for (let flashIdx = 0; flashIdx < 4; flashIdx++) {
                      const delay = flashIdx * 120;
                      setTimeout(() => {
                          const colorConfig = config.sequence[Math.min(flashIdx, config.sequence.length - 1)];
                          const webColor = webColorMap[colorConfig.color][colorConfig.level];
                          const physColor = getLpColor(colorConfig.color, colorConfig.level);
                          for (let ty = 0; ty < 8; ty++) {
                              for (let tx = 0; tx < 8; tx++) {
                                  setWebColor(webColor, [tx, ty]);
                                  setPhysicalColor(physColor, [tx, ty]);
                              }
                          }
                          setTimeout(() => {
                              for (let ty = 0; ty < 8; ty++) {
                                  for (let tx = 0; tx < 8; tx++) {
                                      setWebColor('off', [tx, ty]);
                                      setPhysicalColor(lpOff, [tx, ty]);
                                  }
                              }
                          }, 50);
                      }, delay);
                  }
              },
              type: 'fixed'
          };

          // 24. EQ_BOUNCE_MULTI: Solid columns with fixed gradient (Green -> Amber -> Red)
          animations[`eq_bounce_multi_${config.name}`] = {
              on: () => {
                  const lpOff = getLpColor('off');
                  for (let tx = 0; tx < 8; tx++) {
                      const height = Math.floor(Math.random() * 7) + 1;
                      const peakRow = 8 - height;
                      const speed = 40;
                      const hold = 100;
                      
                      // Funzione per ottenere il colore in base all'altezza (riga)
                      // riga 7,6: verde | riga 5,4,3: arancione | riga 2,1,0: rosso
                      const getGradientColor = (row) => {
                          if (row >= 6) return { lp: getLpColor('green'), web: webColorMap['green'].full };
                          if (row >= 3) return { lp: getLpColor('amber'), web: webColorMap['amber'].full };
                          return { lp: getLpColor('red'), web: webColorMap['red'].full };
                      };

                      // Rise: Accende i pixel con il gradiente
                      for (let ty = 7; ty >= peakRow; ty--) {
                          setTimeout(() => {
                              const color = getGradientColor(ty);
                              setWebColor(color.web, [tx, ty]);
                              setPhysicalColor(color.lp?.full, [tx, ty]);
                          }, (7 - ty) * speed);
                      }

                      // Fall: Spegne i pixel
                      for (let ty = peakRow; ty <= 7; ty++) {
                          const fallDelay = (7 - peakRow) * speed + hold + (ty - peakRow) * speed;
                          setTimeout(() => {
                              setWebColor('off', [tx, ty]);
                              setPhysicalColor(lpOff, [tx, ty]);
                          }, fallDelay);
                      }
                  }
              },
              type: 'fixed'
          };

          // 25. EQ_PEAK_HOLD_MULTI: Columns with fixed gradient and peak hold
          animations[`eq_peak_hold_multi_${config.name}`] = {
              on: () => {
                  const lpOff = getLpColor('off');
                  for (let tx = 0; tx < 8; tx++) {
                      const height = Math.floor(Math.random() * 7) + 1;
                      const peakRow = 8 - height;
                      const speed = 30;
                      const peakHold = 400;
                      
                      const getGradientColor = (row) => {
                          if (row >= 6) return { lp: getLpColor('green'), web: webColorMap['green'].full };
                          if (row >= 3) return { lp: getLpColor('amber'), web: webColorMap['amber'].full };
                          return { lp: getLpColor('red'), web: webColorMap['red'].full };
                      };

                      // Rise
                      for (let ty = 7; ty >= peakRow; ty--) {
                          setTimeout(() => {
                              const color = getGradientColor(ty);
                              setWebColor(color.web, [tx, ty]);
                              setPhysicalColor(color.lp?.full, [tx, ty]);
                          }, (7 - ty) * speed);
                      }

                      // Fast Fall (all except peak)
                      for (let ty = peakRow + 1; ty <= 7; ty++) {
                          const fallDelay = (7 - peakRow) * speed + (ty - peakRow) * speed;
                          setTimeout(() => {
                              setWebColor('off', [tx, ty]);
                              setPhysicalColor(lpOff, [tx, ty]);
                          }, fallDelay);
                      }

                      // Peak Fall (stays longer)
                      const peakFallDelay = (7 - peakRow) * speed + peakHold;
                      setTimeout(() => {
                          setWebColor('off', [tx, peakRow]);
                          setPhysicalColor(lpOff, [tx, peakRow]);
                      }, peakFallDelay);
                  }
              },
              type: 'fixed'
          };

          // 25. VORTEX_MULTI: Eliminato su richiesta utente

          // Default aliases for rotate_multi
          animations[`rotate_cw_multi_${config.name}`] = animations[`rotate_cw_left_multi_${config.name}`];
          animations[`rotate_ccw_multi_${config.name}`] = animations[`rotate_ccw_left_multi_${config.name}`];
      });

      // 26. TETRIS_FALLING: Random Tetris block falling with random color selection
      animations['tetris_falling'] = {
          on: () => {
              const colors = ['red', 'green', 'amber'];
              const colorName = colors[Math.floor(Math.random() * colors.length)];
              const baseColor = getLpColor(colorName);
              const lpOff = getLpColor('off');

              const shapes = [
                  [[0,0], [1,0], [2,0], [3,0]], // I
                  [[0,0], [1,0], [0,1], [1,1]], // O
                  [[1,0], [0,1], [1,1], [2,1]], // T
                  [[1,0], [2,0], [0,1], [1,1]], // S
                  [[0,0], [1,0], [1,1], [2,1]], // Z
                  [[0,0], [0,1], [1,1], [2,1]], // J
                  [[2,0], [0,1], [1,1], [2,1]]  // L
              ];
              
              let shape = shapes[Math.floor(Math.random() * shapes.length)];
              
              // Randomize rotation (0, 90, 180, 270 degrees)
              const rotations = Math.floor(Math.random() * 4);
              for (let i = 0; i < rotations; i++) {
                  shape = shape.map(([x, y]) => [-y, x]);
              }

              // Normalize shape coordinates (bring to 0,0)
              const minX = Math.min(...shape.map(p => p[0]));
              const minY = Math.min(...shape.map(p => p[1]));
              shape = shape.map(([x, y]) => [x - minX, y - minY]);

              const shapeWidth = Math.max(...shape.map(p => p[0])) + 1;
              let curX = Math.floor(Math.random() * (8 - shapeWidth + 1));
              const speed = 150;

              let lastPositions = [];

              for (let curY = -2; curY < 10; curY++) {
                  const delay = (curY + 2) * speed;
                  
                  // Pre-calculate next state
                  let nextX = curX;
                  if (curY >= 0 && curY < 7 && Math.random() > 0.8) {
                      const move = Math.random() > 0.5 ? 1 : -1;
                      if (curX + move >= 0 && curX + move + shapeWidth <= 8) {
                          nextX += move;
                      }
                  }
                  curX = nextX;
                  const stepX = curX;

                  setTimeout(() => {
                      // 1. Clear last positions
                      lastPositions.forEach(([tx, ty]) => {
                          if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) {
                              setWebColor('off', [tx, ty]);
                              setPhysicalColor(lpOff, [tx, ty]);
                          }
                      });

                      lastPositions = [];

                      // 2. Draw new positions
                      shape.forEach(([dx, dy]) => {
                          const tx = stepX + dx;
                          const ty = curY + dy;
                          if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) {
                              setWebColor(webColorMap[colorName].full, [tx, ty]);
                              setPhysicalColor(baseColor?.full, [tx, ty]);
                              lastPositions.push([tx, ty]);
                          }
                      });
                  }, delay);
              }
          },
          type: 'fixed'
      };
  };

// Initialize the library
createAnimationLibrary();

/**
 * Triggers an animation by name at specific coordinates.
 * @param {string} name - The name of the animation in the registry.
 * @param {number} x - The X coordinate (0-7).
 * @param {number} y - The Y coordinate (0-7).
 */
export function triggerAnimation(name, x, y) {
    const anim = animations[name];
    if (anim && anim.on) {
        anim.on(x, y);
    } else if (!anim) {
        console.warn(`Animation "${name}" not found.`);
    }
}

/**
 * Releases an animation (stops it if it's momentary).
 * @param {string} name - The name of the animation in the registry.
 * @param {number} x - The X coordinate (0-7).
 * @param {number} y - The Y coordinate (0-7).
 */
export function releaseAnimation(name, x, y) {
    const anim = animations[name];
    if (anim && anim.type === 'momentary' && anim.off) {
        anim.off(x, y);
    }
}
