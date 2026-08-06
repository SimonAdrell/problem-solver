param accountName string = 'aif-problemsolver-dev'
param modelName string = 'gpt-5.5'
param projectName string = 'proj-problemsolver-dev'
param location string = resourceGroup().location

var tags = { project: 'problem-solver', environment: 'dev' }

resource account 'Microsoft.CognitiveServices/accounts@2026-05-15-preview' = {
  identity: { type: 'SystemAssigned' }
  name: accountName
  location: location
  kind: 'AIServices'
  sku: { name: 'S0' }
  properties: {
    allowProjectManagement: true
    customSubDomainName: accountName
    publicNetworkAccess: 'Enabled'
  }
  tags: tags
}

resource accHost 'Microsoft.CognitiveServices/accounts/capabilityHosts@2026-05-15-preview' = {
  parent: account
  name: 'account-capability-host'
  properties: {
    capabilityHostKind: 'Agents'
  }
}

resource project 'Microsoft.CognitiveServices/accounts/projects@2026-05-15-preview' = {
  name: projectName
  parent: account
  location: location
  identity: { type: 'SystemAssigned' }
  tags: tags
  dependsOn: [accHost]
}

resource projHost 'Microsoft.CognitiveServices/accounts/projects/capabilityHosts@2026-05-15-preview' = {
  parent: project
  name: 'project-capability-host'
  dependsOn: [accHost]
  properties: {}
}

resource deployment 'Microsoft.CognitiveServices/accounts/deployments@2026-05-15-preview' = {
  name: modelName
  parent: account
  dependsOn: [
    project
  ]
  sku: {
    name: 'GlobalStandard'
    capacity: 3
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: modelName
      version: '2026-04-24'
    }
  }
  tags: tags
}

output projectEndpoint string = 'https://${account.name}.services.ai.azure.com/api/projects/${project.name}'
