class BedSelectionManager {
  setupBedSelection(container) {
    if (!container) return;

    container.addEventListener('click', (e) => {
      const bed = e.target.closest('.bed');
      if (!bed || bed.classList.contains('occupied')) return;

      bed.classList.toggle('selected');

      const selected = container.querySelectorAll('.bed.selected');
      const needed = window.stateManager?.getSearchCriteria();
      const totalNeeded = (needed?.men || 0) + (needed?.women || 0);

      const selCount = document.getElementById('selCount');
      const neededEl = document.getElementById('needed');
      
      if (selCount) selCount.textContent = selected.length;
      if (neededEl) neededEl.textContent = totalNeeded;

      const continueBtn = document.getElementById('continueBtn');
      if (continueBtn) {
        continueBtn.disabled = selected.length !== totalNeeded;
      }

      // Actualizar progreso y hold
      if (selected.length === totalNeeded && totalNeeded > 0) {
        const beds = Array.from(selected).map(b => ({
          room: b.dataset.room,
          bed: b.dataset.bed
        }));

        window.stateManager?.setSelectedBeds(beds);
        window.timerManager?.startHold(3);
        window.progressManager?.update();
      }
    });
  }
}

window.bedSelectionManager = new BedSelectionManager();
