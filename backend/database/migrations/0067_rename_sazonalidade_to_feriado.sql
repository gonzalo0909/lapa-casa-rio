-- 0067: el motivo de los bloqueos por temporada/feriado se llamaba "Sazonalidade"; ahora "Feriado".
UPDATE room_blocks SET reason = 'Feriado' WHERE reason = 'Sazonalidade';
