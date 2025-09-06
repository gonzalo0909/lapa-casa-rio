class StateManager {
  constructor() {
    this.memoryStorage = new Map();
    this.state = {
      currentStep: 'search',
      searchCriteria: null,
      availabilityData: null,
      selectedBeds: [],
      formData: {},
      paymentInfo: null,
      bookingData: null
    };
  }
  
  getCurrentStep() {
    return this.state.currentStep;
  }
  
  updateStep(step) {
    this.state.currentStep = step;
    this.saveState();
  }
  
  setSearchCriteria(dateIn, dateOut, men, women) {
    this.state.searchCriteria = { dateIn, dateOut, men, women };
    this.saveState();
  }
  
  getSearchCriteria() {
    return this.state.searchCriteria;
  }
  
  setAvailabilityData(data) {
    this.state.availabilityData = data;
    this.saveState();
  }
  
  isAvailabilityDataValid() {
    return !!this.state.availabilityData;
  }
  
  getAvailabilityData() {
    return this.state.availabilityData;
  }
  
  setSelectedBeds(beds) {
    this.state.selectedBeds = beds;
    this.saveState();
  }
  
  getSelectedBeds() {
    return this.state.selectedBeds;
  }
  
  clearSelectedBeds() {
    this.state.selectedBeds = [];
  }
  
  setFormData(field, value) {
    this.state.formData[field] = value;
    this.saveState();
  }
  
  getFormData() {
    return this.state.formData;
  }
  
  setPaymentInfo(info) {
    this.state.paymentInfo = info;
    this.saveState();
  }
  
  getPaymentInfo() {
    return this.state.paymentInfo;
  }
  
  setBookingData(data) {
    this.state.bookingData = data;
    this.saveState();
  }
  
  getBookingData() {
    return this.state.bookingData;
  }
  
  clearHold() {
    this.state.selectedBeds = [];
  }
  
  getCompleteBookingData() {
    return { ...this.state };
  }
  
  reset() {
    this.state = {
      currentStep: 'search',
      searchCriteria: null,
      availabilityData: null,
      selectedBeds: [],
      formData: {},
      paymentInfo: null,
      bookingData: null
    };
    this.clearSavedState();
  }
  
  saveState() {
    try {
      this.memoryStorage.set('hostelBookingState', { ...this.state });
    } catch (e) {
      console.warn('No se pudo guardar el estado');
    }
  }
  
  loadState() {
    try {
      const saved = this.memoryStorage.get('hostelBookingState');
      if (saved) {
        this.state = { ...saved };
        return true;
      }
    } catch (e) {
      console.warn('No se pudo cargar el estado');
    }
    return false;
  }
  
  clearSavedState() {
    this.memoryStorage.delete('hostelBookingState');
  }
  
  destroy() {
    this.memoryStorage.clear();
  }
}

window.stateManager = new StateManager();
