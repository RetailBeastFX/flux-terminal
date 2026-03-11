import { useRef } from 'react';

/**
 * A draggable vertical divider between two panels.
 * onDrag(dx) is called with the pixel delta from drag start.
 * The parent manages actual width state.
 */
export function Splitter({ onDragStart }) {
  const hovered = useRef(false);
  const elRef   = useRef(null);

  const handleMouseDown = (e) => {
    e.preventDefault();

    const el = elRef.current;
    if (el) {
      el.style.background = '#1d4ed8';
      el.style.width      = '3px';
    }
    // Suppress text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor     = 'col-resize';

    onDragStart(e.clientX);

    const cleanup = () => {
      if (el) {
        el.style.background = hovered.current ? '#1a2535' : '#0c0e15';
        el.style.width      = '4px';
      }
      document.body.style.userSelect = '';
      document.body.style.cursor     = '';
      document.removeEventListener('mouseup', cleanup);
    };
    document.addEventListener('mouseup', cleanup);
  };

  return (
    <div
      ref={elRef}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => {
        hovered.current = true;
        if (elRef.current) elRef.current.style.background = '#1a2535';
      }}
      onMouseLeave={() => {
        hovered.current = false;
        if (elRef.current) elRef.current.style.background = '#0c0e15';
      }}
      style={{
        width:      '4px',
        flexShrink: 0,
        background: '#0c0e15',
        cursor:     'col-resize',
        transition: 'background 0.15s, width 0.1s',
        zIndex:     20,
        position:   'relative',
      }}
    >
      {/* Subtle grip dots */}
      <div style={{
        position:  'absolute',
        top:       '50%',
        left:      '50%',
        transform: 'translate(-50%, -50%)',
        display:   'flex',
        flexDirection: 'column',
        gap:       '3px',
      }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: '2px', height: '2px',
            borderRadius: '50%', background: '#1e2d40',
          }} />
        ))}
      </div>
    </div>
  );
}
