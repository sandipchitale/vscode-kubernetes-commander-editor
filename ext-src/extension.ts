import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';

const YAML = require('json-to-pretty-yaml');

const K8S_RESOURCE_SCHEME = 'k8smsx';
const K8S_RESOURCE_SCHEME_READONLY = 'k8smsxro';
const KUBECTL_RESOURCE_AUTHORITY = 'loadkubernetescore';
const KUBECTL_DESCRIBE_AUTHORITY = 'kubernetesdescribe';

const MANIFEST = 'Manifest';
const TEMPLATES = 'Templates';
const VALUES = 'Values';
const HOOKS = 'Hooks';
const NOTES = 'Notes';
const CHART = 'Chart';
const ALL = 'All';

const GET_TYPES = [
  MANIFEST,
  TEMPLATES,
  VALUES,
  HOOKS,
  NOTES,
  CHART,
  ALL
];

/**
 * Manages webview panels
 */
class KubernetesCommander {
  /**
   * Track the currently panel. Only allow a single panel to exist at a time.
   */
  public static currentPanel: KubernetesCommander | undefined;

  private static readonly viewType = 'KubernetesCommander';

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionPath: string;
  private readonly builtAppFolder: string;
  private disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionPath: string): KubernetesCommander {
    const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

    // If we already have a panel, show it.
    // Otherwise, create KubernetesCommander panel.
    if (KubernetesCommander.currentPanel) {
      KubernetesCommander.currentPanel.panel.reveal(column);
    } else {
      KubernetesCommander.currentPanel = new KubernetesCommander(extensionPath, column || vscode.ViewColumn.One);
    }
    return KubernetesCommander.currentPanel;
  }

  // Interesting order
  // tslint:disable-next-line: member-ordering
  private static apiResourceNamesOrder = [
    'deployments',
    'statefulsets',
    'jobs',
    'daemonsets',
    'cronjobs',
    'pods',
    'configmaps',
    'secrets',
    'ingresses',
    'services',
    'persistentvolumeclaims',
    'persistentvolumes',

    'serviceaccounts',

    'clusterroles',
    'clusterrolebindings',
    'roles',
    'rolebindings',

    'namespaces',
    'nodes',
    'podtemplates',
    'replicasets',
    'replicationcontrollers',
    'storageclasses',
    'volumeattachments',

    'endpoints',
    'endpointslices',

    'ingressclasses',

    'events',

    'certificatesigningrequests',



    'limitranges',
    'resourcequotas',
    'horizontalpodautoscalers',

    'customresourcedefinitions',

    // 'apiservices',
    // 'bindings',
    // 'componentstatuses',
    // 'controllerrevisions',
    // 'csidrivers',
    // 'csinodes',
    // 'leases',
    // 'localsubjectaccessreviews',
    // 'mutatingwebhookconfigurations',
    // 'networkpolicies',
    // 'poddisruptionbudgets',
    // 'podsecuritypolicies',
    // 'priorityclasses',
    // 'runtimeclasses',
    // 'selfsubjectaccessreviews',
    // 'selfsubjectrulesreviews',
    // 'subjectaccessreviews',
    // 'tokenreviews',
    // 'validatingwebhookconfigurations',
  ];

  // tslint:disable-next-line: member-ordering
  private static docsUrlPrefix = 'https://kubernetes.io/docs/reference/kubernetes-api/';

  // tslint:disable-next-line: member-ordering
  private static docsUrlSuffix: any = {
    helmreleases: 'https://helm.sh/docs/chart_template_guide/getting_started/',
    apiservices: 'cluster-resources/api-service-v1',
    bindings: 'cluster-resources/binding-v1',
    certificatesigningrequests: 'authentication-resources/certificate-signing-request-v1',
    clusterrolebindings: 'authorization-resources/cluster-role-binding-v1',
    clusterroles: 'authorization-resources/cluster-role-v1',
    componentstatuses: 'cluster-resources/component-status-v1',
    configmaps: 'config-and-storage-resources/config-map-v1',
    controllerrevisions: 'workload-resources/controller-revision-v1',
    cronjobs: 'workload-resources/cron-job-v1',
    csidrivers: 'config-and-storage-resources/csi-driver-v1',
    csinodes: 'config-and-storage-resources/csi-node-v1',
    customresourcedefinitions: 'extend-resources/custom-resource-definition-v1',
    daemonsets: 'workload-resources/daemon-set-v1',
    deployments: 'workload-resources/deployment-v1',
    endpoints: 'service-resources/endpoints-v1',
    endpointslices: 'service-resources/endpoint-slice-v1',
    events: 'cluster-resources/event-v1',
    horizontalpodautoscalers: 'workload-resources/horizontal-pod-autoscaler-v1',
    ingressclasses: 'service-resources/ingress-class-v1',
    ingresses: 'service-resources/ingress-v1',
    jobs: 'workload-resources/job-v1',
    leases: 'cluster-resources/lease-v1',
    limitranges: 'policy-resources/limit-range-v1',
    localsubjectaccessreviews: 'authorization-resources/local-subject-access-review-v1',
    mutatingwebhookconfigurations: 'extend-resources/mutating-webhook-configuration-v1',
    namespaces: 'cluster-resources/namespace-v1',
    networkpolicies: 'policy-resources/network-policy-v1',
    nodes: 'cluster-resources/node-v1',
    persistentvolumeclaims: 'config-and-storage-resources/persistent-volume-claim-v1',
    persistentvolumes: 'config-and-storage-resources/persistent-volume-v1',
    poddisruptionbudgets: 'policy-resources/pod-disruption-budget-v1',
    pods: 'workload-resources/pod-v1',
    podsecuritypolicies: 'policy-resources/pod-security-policy-v1beta1',
    podtemplates: 'workload-resources/pod-template-v1',
    priorityclasses: 'workload-resources/priority-class-v1',
    replicasets: 'workload-resources/replica-set-v1',
    replicationcontrollers: 'workload-resources/replication-controller-v1',
    resourcequotas: 'policy-resources/resource-quota-v1',
    rolebindings: 'authorization-resources/role-binding-v1',
    roles: 'authorization-resources/role-v1',
    runtimeclasses: 'cluster-resources/runtime-class-v1',
    secrets: 'config-and-storage-resources/secret-v1',
    selfsubjectaccessreviews: 'authorization-resources/self-subject-access-review-v1',
    selfsubjectrulesreviews: 'authorization-resources/self-subject-rules-review-v1',
    serviceaccounts: 'authentication-resources/service-account-v1',
    services: 'service-resources/service-v1',
    statefulsets: 'workload-resources/stateful-set-v1',
    storageclasses: 'config-and-storage-resources/storage-class-v1',
    subjectaccessreviews: 'authorization-resources/subject-access-review-v1',
    tokenreviews: 'authentication-resources/token-review-v1',
    validatingwebhookconfigurations: 'extend-resources/validating-webhook-configuration-v1',
    volumeattachments: 'config-and-storage-resources/volume-attachment-v1',
  };

  // tslint:disable-next-line: member-ordering
  private kubectlApi: k8s.KubectlV1 | undefined = undefined;

  // tslint:disable-next-line: member-ordering
  private configurationApi: k8s.ConfigurationV1 | undefined = undefined;

  // private uri: vscode.Uri | undefined = undefined;

  private constructor(extensionPath: string, column: vscode.ViewColumn) {
    this.extensionPath = extensionPath;
    this.builtAppFolder = 'dist';

    // Create and show a new webview panel
    this.panel = vscode.window.createWebviewPanel(KubernetesCommander.viewType, 'Kubernetes Commander', column, {
      // Enable javascript in the webview
      enableScripts: true,

      retainContextWhenHidden: true,

      // And restrict the webview to only loading content from our extension's `media` directory.
      localResourceRoots: [vscode.Uri.file(path.join(this.extensionPath, this.builtAppFolder))]
    });

    // Set the webview's initial html content
    this.panel.webview.html = this._getHtmlForWebview();
    this.panel.iconPath = vscode.Uri.file(path.join(this.extensionPath, 'images', 'icon.png'));

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programatically
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage((data: any) => {
        switch (data.command) {
          case 'switchNamespace':
            this.switchNamespace(data.namespace);
            break;
          case 'editKubeconfig':
            this.editKubeconfig(data.kubeconfig);
            break;
          case 'editKubeconfigs':
            this.editKubeconfigs();
            break;
          case 'resources':
            this.getResources(data.resourceType, data.allNamespaces, data.showFromNamespaces);
            break;
          case 'get':
            this.getResourceType(data.resourceType, data.allNamespaces, data.showFromNamespaces);
            break;
          case 'describe':
            this.describeResourceType(data.resourceType, data.allNamespaces, data.showFromNamespaces);
            break;
          case 'loadResource':
            this.loadResource(data.resourceType, data.resource);
            break;
          case 'describeResource':
            this.describeResource(data.resourceType, data.resource);
            break;
          case 'deleteResourceType':
            this.deleteResourceType(data.resourceType, data.namespace, data.allNamespaces);
            break;
          case 'deleteResource':
            this.deleteResource(data.resourceType, data.resource);
            break;
          case 'documentation':
            this.documentation(data.resourceTypeName);
            break;
          case 'compareSelectedReleaseRevisions':
            this.compareSelectedReleaseRevisions(
                data.namespace1,
                data.release1,
                data.revision1,
                data.namespace2,
                data.release2,
                data.revision2);
            break;
          case 'settings':
            this.settings();
            break;
          case 'showErrorMessage':
            vscode.window.showErrorMessage(data.message);
            break;
        }

      },
      null,
      this.disposables
    );

    (async () => {
      const kubectl = await k8s.extension.kubectl.v1;
      if (!kubectl.available) {
          vscode.window.showErrorMessage(`kubectl not available.`);
          return;
      } else {
        this.kubectlApi = kubectl.api;
      }

      this.initVersions();
      this.updateContexts();
      this.updateApiResourceTypes();
      const configuration = await k8s.extension.configuration.v1_1;
      if (configuration.available) {
        this.configurationApi = configuration.api;
        configuration.api.onDidChangeKubeconfigPath((kubeconfigPath) => {
          this.initVersions();
          this.updateContexts();
          this.updateApiResourceTypes();
        });
        configuration.api.onDidChangeContext((namespace) => {
          // current context is changed, do something with it
          setTimeout(() => {
            this.updateContexts();
          }, 1000);
        });
        configuration.api.onDidChangeNamespace((namespace) => {
          // current namespace is changed, do something with it
          setTimeout(() => {
            this.updateCurrentNamespace();
          }, 1000);
        });
      }
    })();

    vscode.window.onDidChangeActiveColorTheme((colorTheme: vscode.ColorTheme) => {
      this.setColorTheme(colorTheme);
    });
  }

  async initVersions() {
    let versions = {};
    const versionsShellResult = await this.kubectlApi?.invokeCommand('version --output=json --short');
    if (versionsShellResult) {
      if (versionsShellResult.code === 0) {
        versions = JSON.parse(versionsShellResult.stdout);
      }
    }
    this.panel.webview.postMessage({
      command: 'initVersions',
      versions
    });
  }

  async updateContexts() {
    let contexts;
    const contextsShellResult = await this.kubectlApi?.invokeCommand('config get-contexts');
    if (contextsShellResult) {
      if (contextsShellResult.code === 0) {
        contexts = contextsShellResult.stdout.split(/\r?\n/g).filter((contextLine) => contextLine.trim().length > 0).slice(1);
        contexts = contexts.map((contextLine) => {
          let currentContext = false;
          if (contextLine.startsWith('*')) {
            currentContext = true;
          }
          const name = contextLine.substring(10, 27).trim();
          const clusterName = contextLine.substring(27, 44).trim();
          return {
            name,
            clusterName,
            currentContext
          };
        });

      }
    }

    this.panel.webview.postMessage({
      command: 'updateContexts',
      contexts
    });
    if (contexts) {
      this.updateNamespaces();
    }
  }

  async updateNamespaces() {
    let namespaces: any[] = [];
    const namespacesShellResult = await this.kubectlApi?.invokeCommand(`get namespaces --no-headers -o custom-columns=":metadata.name"`);
    if (namespacesShellResult) {
      if (namespacesShellResult.code === 0) {
        // tslint:disable-next-line: no-shadowed-variable
        namespaces = namespacesShellResult.stdout.split(/\r?\n/g).filter(line => line.trim().length > 0).map((namespace) => {
          return { name: namespace };
        });
      }
    }

    let namespace = '';
    const namespaceShellResult = await this.kubectlApi?.invokeCommand('config view --minify --output "jsonpath={..namespace}"');
    if (namespaceShellResult) {
      if (namespaceShellResult.code === 0) {
        namespace = namespaceShellResult.stdout.split(/\r?\n/g).join('');
      }
    }

    if (namespace) {
      namespaces.forEach((namespaceObject) => {
        namespaceObject.currentNamespace = (namespaceObject.name === namespace);
      });
    }

    this.panel.webview.postMessage({
      command: 'updateNamespaces',
      namespaces
    });
  }

  async updateCurrentNamespace() {
    let namespace = '';
    const namespaceShellResult = await this.kubectlApi?.invokeCommand('config view --minify --output "jsonpath={..namespace}"');
    if (namespaceShellResult) {
      if (namespaceShellResult.code === 0) {
        namespace = namespaceShellResult.stdout.split(/\r?\n/g).join('');
      }
    }

    this.panel.webview.postMessage({
      command: 'namespace',
      namespace
    });
  }

  async updateApiResourceTypes() {
    let resourceTypesToSend: any[] = [];
    const apiResourcesShellResult = await this.kubectlApi?.invokeCommand('api-resources');
    if (apiResourcesShellResult) {
      if (apiResourcesShellResult.stdout && apiResourcesShellResult.stdout.length > 0) {
        const apiResourcesRaw = apiResourcesShellResult.stdout.replace(/true /g, 'true ').replace(/false/g, 'false').split('\n');
        const apiResourcesHeaderRaw = `${apiResourcesRaw.shift()}                               `;

        const columns = apiResourcesHeaderRaw?.match(/^(NAME\s+)(SHORTNAMES\s+)(APIVERSION\s+|APIGROUP\s+)(NAMESPACED\s+)(KIND\s+)$/);
        columns?.shift();

        const columnRanges: number[][] = [];
        let from = 0;
        let to = 0;
        columns?.forEach((column) => {
          to += column.length;
          columnRanges.push([from, to]);
          from = to;
        });

        const apiResources: string[] = [];
        const paddings: number[] = [];
        columnRanges.forEach(columnRange => {
          paddings.push(columnRange[1] - columnRange[0]);
        });
        apiResourcesRaw.forEach((apiResource) => {
          const apiResourcesCols: string[] = [];
          columnRanges.forEach(columnRange => {
            apiResourcesCols.push(apiResource.substring(columnRange[0], columnRange[1]).trim());
          });
          apiResources.push(
            `${apiResourcesCols[0].padEnd(paddings[0])}${apiResourcesCols[1].padEnd(paddings[1])}${apiResourcesCols[2].padEnd(paddings[2])}${apiResourcesCols[3].padStart(paddings[3])}${apiResourcesCols[4]}`
          );
        });

        apiResources.pop();
        apiResources.sort();

        // Order
        const orderedApiResources: string[] = [];
        const resourceTypes = vscode.workspace.getConfiguration().get<string[]>('vscode-kubernetes-commander-editor.resourceTypes');
        if (resourceTypes) {
          KubernetesCommander.apiResourceNamesOrder = resourceTypes;
        }
        KubernetesCommander.apiResourceNamesOrder.forEach((apiResourceName) => {
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const index = apiResources.findIndex(line => line.startsWith(`${apiResourceName} `));
            if (index === -1) {
              break;
            } else {
              orderedApiResources.push(...apiResources.splice(index, 1));
            }
          }
        });

        // tslint:disable-next-line: max-line-length
        const resourceTypesShowOnly = vscode.workspace.getConfiguration().get<string>('vscode-kubernetes-commander-editor.resourceTypesShowOnly');
        if (!resourceTypesShowOnly) {
          orderedApiResources.push(...apiResources);
        }

        resourceTypesToSend = orderedApiResources.map((orderedApiResourceLine) => {

          const apiResourcesCols: string[] = [];
          columnRanges.forEach(columnRange => {
            const col = orderedApiResourceLine.substring(columnRange[0], columnRange[1]).trim();
            apiResourcesCols.push(col);
          });

          return {
            name: apiResourcesCols[0],
            shortName: apiResourcesCols[1],
            api: apiResourcesCols[2],
            namespaced: (apiResourcesCols[3] === 'true' ? true : false),
            kind: apiResourcesCols[4],
            autoRefresh: false
          };
        });

        this.panel.webview.postMessage({
          command: 'resourceTypes',
          resourceTypes: [
            {
              name: 'helmreleases',
              shortName: '',
              api: '',
              namespaced: true,
              kind: 'helm',
              autoRefresh: false,
            },
            ...resourceTypesToSend]
        });
      }
    }
  }

  async switchNamespace(namespace: {name: string}) {
    // tslint:disable-next-line: max-line-length
    const switchNamespaceShellResult = await this.kubectlApi?.invokeCommand(`config set-context --current --namespace=${namespace.name}`);
    if (switchNamespaceShellResult && switchNamespaceShellResult.code === 0) {
      this.updateNamespaces();
    }
  }

  settings() {
    vscode.commands.executeCommand('workbench.action.openSettings', `@ext:sandipchitale.vscode-kubernetes-commander`);
  }

  editKubeconfig(kubeconfig: string) {
    kubeconfig =  kubeconfig.trim().replace(/[\\/]/g, path.sep);
    if (kubeconfig.startsWith('~')) {
      kubeconfig = kubeconfig.replace('~', os.homedir());
    }
    vscode.commands.executeCommand('vscode.open', vscode.Uri.file(kubeconfig));
  }

  editKubeconfigs() {
    // Load configuration
    const config = vscode.workspace.getConfiguration('vs-kubernetes');
    let kubeconfigs = [
      ...config['vs-kubernetes.knownKubeconfigs'],
      config['vs-kubernetes.kubeconfig'],
    ];
    const defaultKubeconfig = path.join(os.homedir(), '.kube', 'config');
    if (fs.lstatSync(defaultKubeconfig).isFile()) {
      kubeconfigs.unshift(defaultKubeconfig);
    }
    if (process.platform === 'win32') {
      kubeconfigs = kubeconfigs.map((kp) => kp.toLowerCase());
    }
    kubeconfigs = [...new Set(kubeconfigs)].filter((k) => k !== '');
    if (kubeconfigs.length > 0) {
      if (kubeconfigs.length === 1) {
        if (fs.lstatSync(kubeconfigs[0]).isFile()) {
          open(kubeconfigs[0]);
        }
      } else {
        vscode.window.showQuickPick(kubeconfigs, {
          placeHolder: 'Select kubeconfig to open',
        })
        .then((selectedKubeconfig) => {
          if (selectedKubeconfig) {
            if (fs.lstatSync(selectedKubeconfig).isFile()) {
              this.open(selectedKubeconfig);
            }
          }
        });
      }
    }
  }

  open(kubeconfig: string) {
    const openPath = vscode.Uri.file(kubeconfig);
    vscode.workspace.openTextDocument(openPath).then((doc) => {
      vscode.window.showTextDocument(doc);
    });
  }

  async getResources(resourceType: any, allNamespaces: boolean, showFromNamespaces: any[]) {

    if (!allNamespaces && showFromNamespaces.length === 0) {
      this.panel.webview.postMessage({
        command: 'resources',
        resourceType,
        resources: []
      });
      return;
    }

    let resources: any[] = [];

    if (resourceType.name === 'helmreleases') {
      const helm = await k8s.extension.helm.v1;
      if (!helm.available) {
          return;
      }

      Promise.all(
        showFromNamespaces.map(async (namespace) => {
          // tslint:disable-next-line: max-line-length
          const helmReleaseResult = await helm.api.invokeCommand(`list ${allNamespaces ? '-A ' : `--namespace ${namespace.name} ` } -o json`);
          if (helmReleaseResult && helmReleaseResult.code === 0) {
            const helmReleases: any[] = JSON.parse(helmReleaseResult.stdout);
            helmReleases.forEach(helmRelease => {
              resources.push({
                name: helmRelease.name,
                namespace: helmRelease.namespace,
                namespaced: true,
                revision: +helmRelease.revision,
                revisions: Array.from({ length: +helmRelease.revision }, (_, index) => ({ revision: +helmRelease.revision - index })),
                selectedRevision0: +helmRelease.revision,
                selectedRevision: +helmRelease.revision,
                selectedForCompare: false,
                status: helmRelease.status,
                version: helmRelease.chart,
              });
            });
          }
        })
      ).then(() => {
        this.panel.webview.postMessage({
          command: 'resources',
          resourceType,
          resources,
        });
      });

      return;
    }

    let getCommand: string;

    if (!resourceType.namespaced || allNamespaces) {
      showFromNamespaces = [{name: ''}]; // Just a way to force 1 loop
    }

    Promise.all(
      showFromNamespaces.map(async (namespace) => {
        if (resourceType.namespaced) {
          getCommand = `get ${allNamespaces ? '-A ' : `--namespace ${namespace.name} `}${resourceType.name} --no-headers -o custom-columns=":metadata.name,:metadata.namespace"`;
        } else {
          getCommand = `get ${resourceType.name} --no-headers -o custom-columns=":metadata.name"`;
        }
        const getResourceTypeResult = await this.kubectlApi?.invokeCommand(getCommand);
        if (getResourceTypeResult && getResourceTypeResult.code === 0) {
          const getOutput = getResourceTypeResult.stdout.split(/\r?\n/g).filter((line) => line.trim().length > 0);
          const resourcesInNamespace = getOutput.map((line) => {
            line = line.trim();
            if (resourceType.namespaced) {
              const lineParts = line.split(/ +/);
              return {
                name: lineParts[0],
                namespace: lineParts[1],
                namespaced: true
              };
            } else {
              return {
                name: line,
                namespaced: false
              };
            }
          });
          if (resourcesInNamespace.length > 0) {
            resources = resources.concat(resourcesInNamespace);
          }
        }
      })
    ).then(() => {
      this.panel.webview.postMessage({
        command: 'resources',
        resourceType,
        resources,
      });
    });

  }

  async getResourceType(resourceType: any, allNamespaces: boolean, showFromNamespaces: any[]) {

    if (!allNamespaces && showFromNamespaces.length === 0) {
      this.panel.webview.postMessage({
        command: 'getResourceType',
        resourceType,
        getOutput: ''
      });
      return;
    }

    if (!resourceType.namespaced || allNamespaces) {
      showFromNamespaces = [{name: ''}]; // Just a way to force 1 loop
    }

    if (resourceType.name === 'helmreleases') {
      const helm = await k8s.extension.helm.v1;
      if (!helm.available) {
        return;
      }

      let helmListResultOutput = '';
      Promise.all(
        showFromNamespaces.map(async (namespace, index) => {
          // tslint:disable-next-line: max-line-length
          const helmListResultInNamespace = await helm.api.invokeCommand(`list ${allNamespaces ? '-A ' : `--namespace ${namespace.name} `}`);
          if (helmListResultInNamespace && helmListResultInNamespace.code === 0) {
            if (helmListResultInNamespace.stdout.trim().length > 0) {
              const trimmedHelmListResultOutput = helmListResultInNamespace.stdout.trim();
              if (trimmedHelmListResultOutput.split(/\r?\n/g).length > 1) {
                helmListResultOutput += `${trimmedHelmListResultOutput}\n`;
              }
            }
          }
        })
      )
      .then(() => {
        this.panel.webview.postMessage({
          command: 'getResourceType',
          resourceType,
          getOutput: helmListResultOutput
        });
      });

      return;
    }

    let getOutput = '';
    Promise.all(
      showFromNamespaces.map(async (namespace) => {
        const getCommand = `get -o wide ${allNamespaces ? '-A ' : `--namespace ${namespace.name} `}${resourceType.name}`;
        const getResourceTypeResult = await this.kubectlApi?.invokeCommand(getCommand);
        if (getResourceTypeResult) {
          if (getResourceTypeResult.code === 0) {
            const getOutputInNamespace = getResourceTypeResult.stdout.split(/\r?\n/g).join('\n');
            if (getOutputInNamespace.trim().length > 0) {
              getOutput += `Namespace: ${namespace.name}\n${getOutputInNamespace.trim()}\n\n`;
            }
          }
        }
      })
    )
    .then(() => {
      this.panel.webview.postMessage({
        command: 'getResourceType',
        resourceType,
        getOutput
      });
    });
  }

  async describeResourceType(resourceType: any, allNamespaces: boolean, showFromNamespaces: any[]) {
    if (resourceType) {
      if (resourceType.name === 'helmreleases') {
        this.panel.webview.postMessage({
          command: 'describeResourceType',
          resourceType,
          describeOutput: ''
        });
        return;
      }

      if (!allNamespaces && showFromNamespaces.length === 0) {
        this.panel.webview.postMessage({
          command: 'describeResourceType',
          resourceType,
          resources: []
        });
        return;
      }

      if (!resourceType.namespaced || allNamespaces) {
        showFromNamespaces = [{name: ''}]; // Just a way to force 1 loop
      }

      let describeOutput = '';
      Promise.all(
        showFromNamespaces.map(async (namespace) => {
          const describeCommand = `describe ${allNamespaces ? '-A ' : `--namespace ${namespace.name} `}${resourceType.name}`;
          const describeResourceTypeResult = await this.kubectlApi?.invokeCommand(describeCommand);
          if (describeResourceTypeResult) {
            if (describeResourceTypeResult.code === 0) {
              const describeOutputInNamespace = describeResourceTypeResult.stdout.split(/\r?\n/g).join('\n');
              if (describeOutputInNamespace.trim().length > 0) {
                describeOutput += `${describeCommand}\n${describeOutputInNamespace}\n\n`;
              }
            }
          }
        })
      ).then(() => {
        this.panel.webview.postMessage({
          command: 'describeResourceType',
          resourceType,
          describeOutput
        });
      });
    }
  }

  async loadResource(resourceType: any, resource: any) {
    if (resourceType.name === 'helmreleases') {
      const helm = await k8s.extension.helm.v1;
      if (!helm.available) {
          return;
      }
      const helmGetManifest = `get manifest ${resource.name} --namespace ${resource.namespace}`;
      const helmGetManifestResult = await helm.api.invokeCommand(helmGetManifest);
      if (helmGetManifestResult && helmGetManifestResult.code === 0) {
        vscode.workspace.openTextDocument({
          language: 'yaml',
          content: `# helm ${helmGetManifest}\n\n${helmGetManifestResult.stdout}`
        }).then((doc) => {
          vscode.window.showTextDocument(doc);
        });
      }
      return;
    }

    const uri = this.kubefsUri(resource.namespace, `${resourceType.kind}/${resource.name}`, '');
    vscode.workspace.openTextDocument(uri).then((doc) => {
      if (doc) {
        // tslint:disable-next-line: no-shadowed-variable
        vscode.languages.setTextDocumentLanguage(doc, 'yaml').then((doc) => {
          vscode.window.showTextDocument(doc);
        });
      }
    },
    (err) => vscode.window.showErrorMessage(`Error loading document: ${err}`));
  }

  async describeResource(resourceType: any, resource: any) {
    if (resourceType.name === 'helmreleases') {
      const helm = await k8s.extension.helm.v1;
      if (!helm.available) {
          return;
      }

      const helmGetTemplateResult = await this.helmGetAllReleaseRevisionFromNamespace(resource.namespace,
        resource.name,
        resource.selectedRevision);
      if (helmGetTemplateResult) {
        let doc: vscode.TextDocument;

        doc = await vscode.workspace.openTextDocument({
          language: 'helm',
          content: `# helm get templates ${resource.name} --namespace ${resource.namespace} --revision ${resource.selectedRevision}\n\n${helmGetTemplateResult[TEMPLATES]}`
        });
        await vscode.window.showTextDocument(doc);

        await vscode.commands.executeCommand('workbench.action.moveEditorToFirstGroup');

        doc = await vscode.workspace.openTextDocument({
          language: 'yaml',
          content: `# helm get values ${resource.name} --namespace ${resource.namespace} --revision ${resource.selectedRevision}\n\n${helmGetTemplateResult[VALUES]}`
        });
        await vscode.window.showTextDocument(doc);

        // create second row of editors
        await vscode.commands.executeCommand('workbench.action.editorLayoutTwoRows');
        await vscode.commands.executeCommand('workbench.action.moveEditorToRightGroup');

        doc = await vscode.workspace.openTextDocument({
          language: 'yaml',
          content: `# helm get manifest ${resource.name} --namespace ${resource.namespace} --revision ${resource.selectedRevision}\n\n${helmGetTemplateResult[MANIFEST]}`
        });
        await vscode.window.showTextDocument(doc);

        await vscode.commands.executeCommand('workbench.action.moveEditorToBelowGroup');

        doc = await vscode.workspace.openTextDocument({
          language: 'yaml',
          content: `# helm get hooks ${resource.name} --namespace ${resource.namespace} --revision ${resource.selectedRevision}\n\n${helmGetTemplateResult[HOOKS]}`
        });
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

        doc = await vscode.workspace.openTextDocument({
          language: 'yaml',
          content: `# helm get chart ${resource.name} --namespace ${resource.namespace} --revision ${resource.selectedRevision}\n\n${helmGetTemplateResult[CHART]}`
        });
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

        doc = await vscode.workspace.openTextDocument({
          language: 'plaintext',
          content: `# helm get notes ${resource.name} --namespace ${resource.namespace} --revision ${resource.selectedRevision}\n\n${helmGetTemplateResult[NOTES]}`
        });
        await vscode.window.showTextDocument(doc);

      }
      return;
    }

    const uri = this.kubefsUri(resource.namespace, `${resourceType.kind}/${resource.name}`, '', 'describe');
    vscode.workspace.openTextDocument(uri).then((doc) => {
      if (doc) {
        // tslint:disable-next-line: no-shadowed-variable
        vscode.languages.setTextDocumentLanguage(doc, 'yaml').then((doc) => {
          vscode.window.showTextDocument(doc);
        });
      }
    },
    (err) => vscode.window.showErrorMessage(`Error loading document: ${err}`));
  }

  async deleteResourceType(resourceType: any, namespace: boolean, allNamespaces: boolean) {
    if (allNamespaces) {
      return;
    }
    if (resourceType.namespaced) {
      if (resourceType.name === 'helmreleases') {
        const helm = await k8s.extension.helm.v1;
        if (!helm.available) {
            return;
        }
        const helmListResult = await helm.api.invokeCommand(`list -q -o json --namespace ${namespace}`);
        if (helmListResult) {
          if (helmListResult.code === 0) {
            const helmReleases = JSON.parse(helmListResult.stdout);
            const yesNo = await vscode.window.showInformationMessage(
              `Uninstall all Helm releases in namespace '${namespace}'?\n\n${helmReleases.join('\n')}`, {
              modal: true
            }, 'Yes');
            if (yesNo === 'Yes') {
              helmReleases.forEach( async (helmRelease: string) => {
                const helmUninstallResult = await helm.api.invokeCommand(`uninstall ${helmRelease}`);
                if (helmUninstallResult) {
                  if (helmUninstallResult.code === 0) {
                    await vscode.window.showInformationMessage(`Uninstalled helm release ${helmRelease} in namespace '${namespace}'.`);
                  } else {
                    vscode.window.showErrorMessage(helmUninstallResult.stderr);
                  }
                }
              });
            }
          } else {
            vscode.window.showErrorMessage(helmListResult.stderr);
          }
        }
      } else {
        const yesNo = await vscode.window.showInformationMessage(`Delete all ${resourceType.name} in namespace '${namespace}' ?`, {
          modal: true
        }, 'Yes');
        if (yesNo === 'Yes') {
          // tslint:disable-next-line: max-line-length
          const deleteAllResult = await this.kubectlApi?.invokeCommand(`delete ${resourceType.name} --namespace ${namespace} --all`);
          if (deleteAllResult) {
            if (deleteAllResult.code === 0) {
              await vscode.window.showInformationMessage(`Deleted all ${resourceType.name} resources in namespace '${namespace}'.`);
            } else {
              vscode.window.showErrorMessage(deleteAllResult.stderr);
            }
          }
        }
      }
    } else {
      const yesNo = await vscode.window.showInformationMessage(`Delete all ${resourceType.name} ?`, {
        modal: true
      }, 'Yes');
      if (yesNo === 'Yes') {
        // tslint:disable-next-line: max-line-length
        const deleteAllResult = await this.kubectlApi?.invokeCommand(`delete ${resourceType.name} --all`);
        if (deleteAllResult) {
          if (deleteAllResult.code === 0) {
            await vscode.window.showInformationMessage(`Deleted all ${resourceType.name} resources.`);
          } else {
            vscode.window.showErrorMessage(deleteAllResult.stderr);
          }
        }
      }
    }
  }

  async deleteResource(resourceType: any, resource: any) {
    if (resourceType.namespaced) {
      if (resourceType.name === 'helmreleases') {
        const helm = await k8s.extension.helm.v1;
        if (!helm.available) {
            return;
        }
        // tslint:disable-next-line: max-line-length
        const yesNo = await vscode.window.showInformationMessage(`Uninstall Helm Release '${resource.name}' in namespace '${resource.namespace} ?'`, {
          modal: true
        }, 'Yes');
        if (yesNo === 'Yes') {
          // tslint:disable-next-line: max-line-length
          const helmUninstallResult = await helm.api.invokeCommand(`uninstall ${resource.name} --namespace ${resource.namespace}`);
          if (helmUninstallResult) {
            if (helmUninstallResult.code === 0) {
              // tslint:disable-next-line: max-line-length
              await vscode.window.showInformationMessage(`Uninstalled ${resource.name} in namespace '${resource.namespace}'.`);
            } else {
              vscode.window.showErrorMessage(helmUninstallResult.stderr);
            }
          }
        }
      } else {
        // tslint:disable-next-line: max-line-length
        const yesNo = await vscode.window.showInformationMessage(`Delete ${resourceType.name} ${resource.name} in namespace '${resource.namespace}' ?`, {
          modal: true
        }, 'Yes');
        if (yesNo === 'Yes') {
          // tslint:disable-next-line: max-line-length
          const deleteResult = await this.kubectlApi?.invokeCommand(`delete ${resourceType.name} ${resource.name} --namespace ${resource.namespace}`);
          if (deleteResult) {
            if (deleteResult.code === 0) {
              // tslint:disable-next-line: max-line-length
              await vscode.window.showInformationMessage(`Deleted ${resourceType.name} ${resource.name} in namespace '${resource.namespace}'.`);
            } else {
              vscode.window.showErrorMessage(deleteResult.stderr);
            }
          }
        }
      }
    } else {
      // tslint:disable-next-line: max-line-length
      const yesNo = await vscode.window.showInformationMessage(`Delete ${resourceType.name} ${resource.name} ?`, {
        modal: true
      }, 'Yes');
      if (yesNo === 'Yes') {
        // tslint:disable-next-line: max-line-length
        const deleteResult = await this.kubectlApi?.invokeCommand(`delete ${resourceType.name} ${resource.name}`);
        if (deleteResult) {
          if (deleteResult.code === 0) {
            // tslint:disable-next-line: max-line-length
            await vscode.window.showInformationMessage(`Deleted ${resourceType.name} ${resource.name}.`);
          } else {
            vscode.window.showErrorMessage(deleteResult.stderr);
          }
        }
      }
    }
  }

  documentation(resourceTypeName: string) {
    const docsUrlSuffix = KubernetesCommander.docsUrlSuffix[resourceTypeName];
    if (docsUrlSuffix) {
      const url = docsUrlSuffix.startsWith('http') ?
        docsUrlSuffix : `${KubernetesCommander.docsUrlPrefix}${docsUrlSuffix}`;
      vscode.env.openExternal(
        vscode.Uri.parse(url));
    }
  }

  setColorTheme(colorTheme: vscode.ColorTheme) {
    this.panel.webview.postMessage({
      command: 'colorTheme',
      colorTheme
    });
  }
  efreshView() {
    this.panel.webview.postMessage({
      command: 'refreshView'
    });
  }

  async compareSelectedReleaseRevisions(
    namespace1: string,
    release1: string,
    revision1: number,
    namespace2: string,
    release2: string,
    revision2: number) {

    const helm = await k8s.extension.helm.v1;
    if (!helm.available) {
        return;
    }

    const compareWhat = await vscode.window.showQuickPick(GET_TYPES, {
      placeHolder: 'Compare what?',
    });

    if (!compareWhat) {
      return;
    }

    const helmGetAllResult1 = await this.helmGetAllReleaseRevisionFromNamespace(namespace1, release1, '' + revision1);
    const helmGetAllResult2 = await this.helmGetAllReleaseRevisionFromNamespace(namespace2, release2, '' + revision2);
    if (helmGetAllResult1 && helmGetAllResult2) {
      let lang = 'yaml';
      if (compareWhat === TEMPLATES) {
        lang = 'helm';
      } else if (compareWhat === NOTES) {
        lang = 'plaintext';
      }
      const document1 = await vscode.workspace.openTextDocument({
        language: lang,
        content: `# helm get ${compareWhat} ${release1} --namespace ${namespace1} --revision ${revision1}\n\n${helmGetAllResult1[compareWhat]}`
      });
      const document2 = await vscode.workspace.openTextDocument({
        language: lang,
        content: `# helm get ${compareWhat} ${release2} --namespace ${namespace2} --revision ${revision2}\n\n${helmGetAllResult2[compareWhat]}`
      });
      vscode.commands.executeCommand('vscode.diff', document1.uri, document2.uri);
    }
  }

  // tslint:disable-next-line: max-line-length
  async helmGetAllReleaseRevisionFromNamespace(
    namespace: string,
    releaseName: string,
    releaseRevision: string): Promise<any> {
    const explorer = await k8s.extension.clusterExplorer.v1;

    return new Promise(async (resolve, reject) => {
      if (!explorer.available) {
        vscode.window.showErrorMessage(`ClusterExplorer not available.`);
        reject();
        return;
      }

      const kubectl = await k8s.extension.kubectl.v1;
      if (!kubectl.available) {
        vscode.window.showErrorMessage(`kubectl not available.`);
        reject();
        return;
      }

      const secretName = `sh.helm.release.v1.${releaseName}.v${releaseRevision}`;
      const shellResult = await kubectl.api.invokeCommand(`get secret ${secretName} -o go-template="{{.data.release | base64decode }}" -n ${namespace}`);
      if (shellResult && shellResult.code === 0) {
        zlib.gunzip(Buffer.from(shellResult.stdout, 'base64'), async (e, inflated) => {
          const helmGetAllJSON: any = JSON.parse(inflated.toString('utf8'));
          let notes = '';
          let values = '';
          let templates = '';
          let manifests = '';
          let hooks = '';
          let chart = '';

          notes = helmGetAllJSON.info.notes.split('\\n').join('\n');

          helmGetAllJSON.chart.templates.forEach((template: any) => {
              const templateString = Buffer.from(template.data, 'base64').toString('utf-8');
              templates += `\n---\n# Template: ${template.name}\n${templateString}`;
              template.data = templateString;
          });
          templates = templates.split('\\n').join('\n');

          if (helmGetAllJSON.config) {
              values += `# value overrides\n---\n${YAML.stringify(helmGetAllJSON.config)}`;
          }

          values += `# values\n---\n${YAML.stringify(helmGetAllJSON.chart.values)}`;

          manifests = helmGetAllJSON.manifest.split('\\n').join('\n');

          helmGetAllJSON.hooks.forEach((hook: any) => {
              hooks += `\n# Source: ${hook.path}\n${hook.manifest}`;
          });
          hooks = hooks.split('\\n').join('\n');

          helmGetAllJSON.chart.files.forEach((file: any) => {
              file.data = Buffer.from(file.data, 'base64').toString('utf-8');
          });

          chart = YAML.stringify(helmGetAllJSON.chart.metadata);

          const releaseInfo: any = {};

          releaseInfo[MANIFEST] =  manifests;
          releaseInfo[TEMPLATES] = templates;
          releaseInfo[VALUES] = values;
          releaseInfo[CHART] = chart;
          releaseInfo[HOOKS] =  hooks;
          releaseInfo[ALL] = `${JSON.stringify(helmGetAllJSON, null, '  ')}`;
          releaseInfo[NOTES] = notes;
          resolve(releaseInfo);
        });
      }
    });
  }

  private kubefsUri(namespace: string | null | undefined, value: string, outputFormat: string, action?: string): vscode.Uri {
      const docname = `${value.replace('/', '-')}${outputFormat !== '' ? '.' + outputFormat : ''}`;
      const nonce = new Date().getTime();
      const nsquery = namespace ? `ns=${namespace}&` : '';
      const scheme = action === 'describe' ? K8S_RESOURCE_SCHEME_READONLY : K8S_RESOURCE_SCHEME;
      const authority = action === 'describe' ? KUBECTL_DESCRIBE_AUTHORITY : KUBECTL_RESOURCE_AUTHORITY;
      const uri = `${scheme}://${authority}/${docname}?${nsquery}value=${value}&_=${nonce}`;
      return vscode.Uri.parse(uri);
  }

  public dispose() {
    KubernetesCommander.currentPanel = undefined;

    // Clean up our resources
    this.panel.dispose();

    while (this.disposables.length) {
      const x = this.disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  /**
   * Returns html of the start page (index.html)
   */
  private _getHtmlForWebview() {
    // path to dist folder
    const appDistPath = path.join(this.extensionPath, 'dist');
    const appDistPathUri = vscode.Uri.file(appDistPath);

    // path as uri
    const baseUri = this.panel.webview.asWebviewUri(appDistPathUri);

    // get path to index.html file from dist folder
    const indexPath = path.join(appDistPath, 'index.html');

    // read index file from file system
    let indexHtml = fs.readFileSync(indexPath, { encoding: 'utf8' });

    // update the base URI tag
    indexHtml = indexHtml.replace('<base href="/">', `<base href="${String(baseUri)}/">`);

    return indexHtml;
  }
}

// Utility
const isFile = (fsPath: string) => {
  try {
    return fs.statSync(fsPath) && fs.statSync(fsPath).isFile();
  } catch (e) {
    return false;
  }
};

/**
 * Activates extension
 * @param context vscode extension context
 */
export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-kubernetes-commander-editor.show-kubernetes-commander', () => {
      KubernetesCommander.createOrShow(context.extensionPath);
    })
  );
}
