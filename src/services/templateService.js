const Handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class TemplateService {
  constructor() {
    this.templates = new Map();
    this.templatesPath = path.join(__dirname, '../templates');
  }

  /**
   * Load all templates from the templates directory
   */
  async loadTemplates() {
    try {
      const files = await fs.readdir(this.templatesPath);
      const templateFiles = files.filter(file => file.endsWith('.hbs') || file.endsWith('.html'));

      for (const file of templateFiles) {
        const templateId = path.basename(file, path.extname(file));
        const templatePath = path.join(this.templatesPath, file);
        const templateContent = await fs.readFile(templatePath, 'utf-8');

        this.templates.set(templateId, Handlebars.compile(templateContent));
        logger.info(`Loaded template: ${templateId}`);
      }

      logger.info(`Loaded ${this.templates.size} templates`);
    } catch (error) {
      logger.error('Failed to load templates', {
        error: error.message,
        path: this.templatesPath,
      });
    }
  }

  /**
   * Render a template with data
   * @param {string} templateId - Template identifier
   * @param {Object} data - Data to render in template
   * @returns {string} Rendered template
   */
  render(templateId, data = {}) {
    const template = this.templates.get(templateId);

    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    try {
      return template(data);
    } catch (error) {
      logger.error('Template rendering failed', {
        templateId,
        error: error.message,
      });

      throw new Error(`Template rendering failed: ${error.message}`);
    }
  }

  /**
   * Check if a template exists
   * @param {string} templateId - Template identifier
   * @returns {boolean}
   */
  hasTemplate(templateId) {
    return this.templates.has(templateId);
  }

  /**
   * Get list of available templates
   * @returns {string[]} Array of template IDs
   */
  getAvailableTemplates() {
    return Array.from(this.templates.keys());
  }

  /**
   * Register a custom Handlebars helper
   * @param {string} name - Helper name
   * @param {Function} fn - Helper function
   */
  registerHelper(name, fn) {
    Handlebars.registerHelper(name, fn);
  }

  /**
   * Initialize the template service
   */
  async initialize() {
    // Register common helpers
    this.registerHelper('uppercase', (str) => str.toUpperCase());
    this.registerHelper('lowercase', (str) => str.toLowerCase());
    this.registerHelper('formatDate', (date) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    });
    this.registerHelper('formatDateTime', (date) => {
      return new Date(date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    });

    await this.loadTemplates();
  }
}

module.exports = new TemplateService();
