class BedSelectionManager {
  constructor() {
    this.eventListeners = new Map();
    this.isDestroyed = false;
  }
  
  setupBedSelection(container) {
    if (!container || this.isDestroyed) return;
    
    this.cleanup();
    
    const clickHandler = (e) => {
      const bed = e.target.closest('.bed');
      if (!bed) return;
      
      if (bed.classList.contains('occupied')) {
        if (window.toastManager) {
          window.toastManager.showWarning('Esta cama está ocupada');
        }
        return;
      }
      
      const wasSelected = bed.classList.contains('selected');
      bed.classList.toggle('selected');
      
      const selected = container.querySelectorAll('.bed.selected');
      const needed = window.stateManager?.getSearchCriteria();
      const totalNeeded = (needed?.men || 0) + (needed?.women || 0);
      
      this.updateUI(selected.length, totalNeeded);
      
      if (selected.length === totalNeeded && totalNeeded > 0) {
        const beds = Array.from(selected).map(b => ({
          room: b.dataset.room,
          bed: b.dataset.bed
        }));
        
        if (this.validateBedSelection(beds, needed.men, needed.women)) {
          window.stateManager?.setSelectedBeds(beds);
          window.timerManager?.startHold(3);
          window.progressManager?.update();
          
          if (window.toastManager) {
            window.toastManager.showSuccess('Camas seleccionadas correctamente');
          }
        }
      } else if (selected.length > totalNeeded) {
        if (window.toastManager) {
          window.toastManager.showWarning(`Máximo ${totalNeeded} camas permitidas`);
        }
      }
    };
    
    container.addEventListener('click', clickHandler);
    this.eventListeners.set('bed-container-click', {
      element: container,
      event: 'click',
      handler: clickHandler
    });
  }
  
  validateBedSelection(beds, men, women) {
    if (!window.roomManager) return true;
    
    const validation = window.roomManager.validateBedSelection(beds, men, women);
    
    if (!validation.valid && validation.errors.length > 0) {
      if (window.toastManager) {
        window.toastManager.showError(validation.errors[0]);
      }
      return false;
    }
    
    if (validation.warnings.length > 0) {
      if (window.toastManager) {
        validation.warnings.forEach(warning => {
          window.toastManager.showWarning(warning);
        });
      }
    }
    
    return true;
  }
  
  updateUI(selectedCount, totalNeeded) {
    const selCount = document.getElementById('selCount');
    const neededEl = document.getElementById('needed');
    const continueBtn = document.getElementById('continueBtn');
    
    if (selCount) selCount.textContent = selectedCount;
    if (neededEl) neededEl.textContent = totalNeeded;
    
    if (continueBtn) {
      continueBtn.disabled = selectedCount !== totalNeeded || totalNeeded === 0;
      
      if (selectedCount === totalNeeded && totalNeeded > 0) {
        continueBtn.classList.add('ready');
      } else {
        continueBtn.classList.remove('ready');
      }
    }
  }
  
  clearSelection() {
    document.querySelectorAll('.bed.selected').forEach(bed => {
      bed.classList.remove('selected');
    });
    
    this.updateUI(0, 0);
    
    if (window.stateManager) {
      window.stateManager.clearSelectedBeds();
    }
  }
  
  selectBedsAutomatically(roomId, count) {
    const room = document.querySelector(`[data-room="${roomId}"]`);
    if (!room) return false;
    
    const availableBeds = room.querySelectorAll('.bed:not(.occupied):not(.selected)');
    
    if (availableBeds.length < count) {
      if (window.toastManager) {
        window.toastManager.showError(`Solo ${availableBeds.length} camas disponibles en habitación ${roomId}`);
      }
      return false;
    }
    
    for (let i = 0; i < count && i < availableBeds.length; i++) {
      availableBeds[i].classList.add('selected');
    }
    
    return true;
  }
  
  highlightRecommendedBeds(recommendedRooms) {
    document.querySelectorAll('.bed').forEach(bed => {
      bed.classList.remove('recommended');
    });
    
    recommendedRooms.forEach(roomId => {
      const room = document.querySelector(`[data-room="${roomId}"]`);
      if (room) {
        const beds = room.querySelectorAll('.bed:not(.occupied)');
        beds.forEach(bed => bed.classList.add('recommended'));
      }
    });
  }
  
  getSelectionSummary() {
    const selected = document.querySelectorAll('.bed.selected');
    const byRoom = {};
    
    selected.forEach(bed => {
      const roomId = bed.dataset.room;
      if (!byRoom[roomId]) byRoom[roomId] = [];
      byRoom[roomId].push({
        bed: bed.dataset.bed,
        level: this.getBedLevel(parseInt(bed.dataset.bed))
      });
    });
    
    return {
      total: selected.length,
      byRoom,
      beds: Array.from(selected).map(bed => ({
        room: bed.dataset.room,
        bed: bed.dataset.bed,
        level: this.getBedLevel(parseInt(bed.dataset.bed))
      }))
    };
  }
  
  getBedLevel(bedNumber) {
    const position = ((bedNumber - 1) % 3) + 1;
    switch (position) {
      case 1: return 'Baja';
      case 2: return 'Media';
      case 3: return 'Alta';
      default: return 'Baja';
    }
  }
  
  cleanup() {
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners.clear();
  }
  
  destroy() {
    this.cleanup();
    this.isDestroyed = true;
  }
}

window.bedSelectionManager = new BedSelectionManager();
