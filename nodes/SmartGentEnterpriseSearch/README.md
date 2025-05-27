# SmartGent Enterprise Search Node

## Overview

The SmartGent Enterprise Search node provides AI-powered search capabilities for enterprise data. It integrates with the SmartGent API to retrieve available chatbots and perform intelligent searches using selected chatbots.

## Features

- 🤖 **Get Chatbots** - Retrieve list of available enterprise chatbots
- 🔍 **Intelligent Search** - Search using selected chatbots with AI-powered responses
- 📋 **Dynamic Chatbot Selection** - Choose from available chatbots loaded from the API
- 🔍 **Advanced Filtering** - Apply custom filters to search results
- 📊 **Configurable Results** - Control result count and pricing inclusion

## Configuration

### Credentials
The node requires SmartGent API credentials:
- **API Key**: Your SmartGent API key
- **Base URL**: The SmartGent API base URL (default: https://smartgendev.w3btest.com)

### Parameters

#### Required
- **Operation**: Choose the operation to perform
  - Get Chatbots: Retrieve list of available chatbots
  - Search: Perform search using a selected chatbot

#### For Search Operation
- **Chatbot**: Select from available chatbots (dynamically loaded)
- **Search Query**: The search query to execute

#### Optional
- **Max Results**: Maximum number of results to return (default: 10)
- **Include Pricing**: Whether to include pricing information
- **Search Filters**: Custom field-value filters to apply

## Usage Example

### Getting Available Chatbots
1. Add the SmartGent Enterprise Search node to your workflow
2. Configure your SmartGent API credentials
3. Select "Get Chatbots" as the operation
4. Execute the node to retrieve available chatbots

### Performing a Search
1. Add another SmartGent Enterprise Search node
2. Select "Search" as the operation
3. Choose a chatbot from the dropdown (e.g., "EPRC", "IT_Chatbot", "Insurance-GL20")
4. Enter your search query
5. Execute the node

## API Endpoints

The node uses the following SmartGent API endpoints:
- Get Chatbots: `/api/v1/rag/enterprise/group/chatbot` (GET)
- Search: `/api/v1/rag/enterprise/groupsearch` (POST)

## Output

### Get Chatbots Operation
Returns structured data including:
- Operation type ("getChatbots")
- Success status
- Array of available chatbots with name, GUID, and description
- Chatbot count
- Timestamp

### Search Operation
Returns structured data including:
- Operation type ("search")
- Selected chatbot GUID
- Search query
- Search results from the API
- Result count
- Timestamp
- Any applied filters

## Error Handling

The node includes comprehensive error handling:
- API authentication errors
- Network connectivity issues
- Invalid search parameters
- Rate limiting responses

Enable "Continue on Fail" to handle errors gracefully in your workflow. 