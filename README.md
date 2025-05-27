# 🤖 n8n-nodes-smartgent

**SmartGent Custom Nodes for n8n** - AI-powered automation and intelligent workflow integrations.

[![npm version](https://badge.fury.io/js/n8n-nodes-smartgent.svg)](https://badge.fury.io/js/n8n-nodes-smartgent)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Overview

SmartGent brings intelligent automation to your n8n workflows with AI-powered nodes that enhance productivity and streamline complex processes. This package provides custom n8n nodes designed for modern automation needs.

## ✨ Features

- 🧠 **AI-Powered Processing** - Intelligent data transformation and analysis
- 🔗 **Smart Integrations** - Seamless connections with modern APIs and services
- 🛡️ **Secure Authentication** - Robust credential management for various services
- 📊 **Advanced Analytics** - Built-in data processing and insights
- 🎯 **User-Friendly** - Intuitive interface design for complex operations

## 📦 Installation

### From npm Registry
```bash
npm install n8n-nodes-smartgent
```

### For Development
```bash
# Clone the repository
git clone https://github.com/smartgent/n8n-nodes-smartgent.git
cd n8n-nodes-smartgent

# Install dependencies
npm install

# Start development mode
npm run dev
```

## 🔧 Available Nodes

### Example Nodes (Templates)
- **ExampleNode** - Basic transformation node template
- **HttpBin** - HTTP API integration example

*More SmartGent-specific nodes coming soon!*

## 🛠️ Development

### Prerequisites
- Node.js >= 20.15
- npm or pnpm
- n8n installed globally: `npm install n8n -g`

### Development Scripts
```bash
npm run dev        # Start TypeScript watch mode
npm run build      # Build the project
npm run lint       # Check for linting errors
npm run lintfix    # Auto-fix linting errors
npm run format     # Format code with Prettier
```

### Testing Your Nodes
1. Build the project: `npm run build`
2. Link the package: `npm link`
3. In your n8n installation: `npm link n8n-nodes-smartgent`
4. Start n8n: `n8n start --tunnel`

### Creating New Nodes
1. Copy an existing node folder as a template
2. Modify the node class, description, and execute function
3. Update `package.json` to include your new node in the `n8n.nodes` array
4. Build and test your node

## 📁 Project Structure

```
n8n-nodes-smartgent/
├── nodes/                    # Custom node implementations
│   ├── ExampleNode/         # Example transformation node
│   └── HttpBin/             # Example HTTP integration
├── credentials/             # Authentication configurations
│   ├── ExampleCredentialsApi.credentials.ts
│   └── HttpBinApi.credentials.ts
├── dist/                    # Compiled output (generated)
├── package.json            # Package configuration
├── tsconfig.json           # TypeScript configuration
└── gulpfile.js            # Build configuration
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run linting: `npm run lint`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## 🔗 Links

- [n8n Documentation](https://docs.n8n.io/)
- [Creating Custom Nodes](https://docs.n8n.io/integrations/creating-nodes/)
- [SmartGent Website](https://smartgent.ai) *(coming soon)*

## 📞 Support

For support and questions:
- 📧 Email: support@smartgent.ai
- 🐛 Issues: [GitHub Issues](https://github.com/smartgent/n8n-nodes-smartgent/issues)
- 📖 Documentation: [Wiki](https://github.com/smartgent/n8n-nodes-smartgent/wiki)

---

Made with ❤️ by the SmartGent Team
