import { createSkyCMSEditor } from '../src/index';

/**
 * Initialize the playground
 */
async function initializePlayground() {
  const container = document.getElementById('editor');
  
  if (!container) {
    console.error('Editor container not found');
    return;
  }
  
  try {
    const editor = await createSkyCMSEditor(container, {
      value: `<!-- Welcome to SkyCMS Monaco Editor -->
<div class="welcome">
  <h1>Hello Monaco!</h1>
  <p>Start editing...</p>
</div>`,
      language: 'html',
    });
    
    console.log('Monaco Editor initialized successfully');
  } catch (error) {
    console.error('Failed to initialize editor:', error);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePlayground);
} else {
  initializePlayground();
}
