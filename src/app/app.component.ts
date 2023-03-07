import { AfterViewInit, Component, Inject, NgZone, OnInit, ViewChild } from '@angular/core';
import { DOCUMENT } from '@angular/common';

import { TranslateService } from '@ngx-translate/core';

import { AppService } from './app.service';

import { MenuItem } from 'primeng/api';

interface ResourceType {
  name: string;
  shortName: string;
  api: string;
  namespaced: boolean;
  kind: string;
  autoRefresh?: boolean;
  showFilters?: boolean;
}
interface Context {
  name: string;
  clusterName: string;
  currentContext;
}

interface Namespace {
  name: string;
  currentNamespace: boolean;
}

interface Resource {
  name: string;
  namespaced: boolean;
  namespace?: string;
  selectedRevision0?: number;
  selectedRevision?: number;
  selectedForCompare?: boolean;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, AfterViewInit {

  @ViewChild('main')
  mainElement;

  public busy = false;

  clientVersion = '';
  serverVersion = '';

  public kubeconfig = '~\\.kube\\config';

  public contexts: Context[] = [
  ];

  private readonly UNKNOWN_CONTEXT = { name: 'UNKNOWN', clusterName: 'UNKNOWN', currentContext: false };
  public selectedContext: Context;

  private readonly UNKNOWN_NAMESPACE: Namespace = { name: 'UNKNOWN', currentNamespace: true };
  public namespaces: Namespace[] = [
    this.UNKNOWN_NAMESPACE
  ];

  // tslint:disable-next-line: variable-name
  _selectedNamespace: Namespace = this.namespaces[0];

  showFromNamespacesDidChange = false;

  showFromNamespaces: Namespace[] = [];

  public allNamespaces = false;

  public resourceTypes: Array<ResourceType> = [
    // { name: 'nodes', shortName: 'no', api: 'v1', namespaced: false, kind: 'Node'},
    // { name: 'namespaces', shortName: 'ns', api: 'v1', namespaced: false, kind: 'Namespace'},
    // { name: 'pods', shortName: 'po', api: 'v1', namespaced: true , kind: 'Pod'},
    // { name: 'podtemplates', shortName: '', api: 'v1', namespaced: true , kind: 'PodTemplate'},
    // { name: 'cronjobs', shortName: 'cj', api: 'batch/v1', namespaced: true , kind: 'CronJob'},
    // { name: 'daemonsets', shortName: 'ds', api: 'apps/v1', namespaced: true , kind: 'DaemonSet'},
    // { name: 'deployments', shortName: 'deploy', api: 'apps/v1', namespaced: true , kind: 'Deployment'},
    // { name: 'replicasets', shortName: 'rs', api: 'apps/v1', namespaced: true , kind: 'ReplicaSet'},
    // { name: 'jobs', shortName: '', api: 'batch/v1', namespaced: true , kind: 'Job'},
    // { name: 'statefulsets', shortName: 'sts', api: 'apps/v1', namespaced: true , kind: 'StatefulSet'},
    // { name: 'replicationcontrollers', shortName: 'rc', api: 'v1', namespaced: true , kind: 'ReplicationController'},
    // { name: 'configmaps', shortName: 'cm', api: 'v1', namespaced: true , kind: 'ConfigMap'},
    // { name: 'secrets', shortName: '', api: 'v1', namespaced: true , kind: 'Secret'},
    // { name: 'storageclasses', shortName: 'sc', api: 'storage.k8s.io/v1', namespaced: false, kind: 'StorageClass'},
    // { name: 'persistentvolumes', shortName: 'pv', api: 'v1', namespaced: false, kind: 'PersistentVolume'},
    // { name: 'persistentvolumeclaims', shortName: 'pvc', api: 'v1', namespaced: true , kind: 'PersistentVolumeClaim'},
    // { name: 'volumeattachments', shortName: '', api: 'storage.k8s.io/v1', namespaced: false, kind: 'VolumeAttachment'},
    // { name: 'services', shortName: 'svc', api: 'v1', namespaced: true , kind: 'Service'},
    // { name: 'endpoints', shortName: 'ep', api: 'v1', namespaced: true , kind: 'Endpoints'},
    // { name: 'endpointslices', shortName: '', api: 'discovery.k8s.io/v1', namespaced: true , kind: 'EndpointSlice'},
    // { name: 'ingressclasses', shortName: '', api: 'networking.k8s.io/v1', namespaced: false, kind: 'IngressClass'},
    // { name: 'ingresses', shortName: 'ing', api: 'extensions/v1beta1', namespaced: true , kind: 'Ingress'},
    // { name: 'ingresses', shortName: 'ing', api: 'networking.k8s.io/v1', namespaced: true , kind: 'Ingress'},
    // { name: 'events', shortName: 'ev', api: 'events.k8s.io/v1', namespaced: true , kind: 'Event'},
    // { name: 'events', shortName: 'ev', api: 'v1', namespaced: true , kind: 'Event'},
    // { name: 'serviceaccounts', shortName: 'sa', api: 'v1', namespaced: true , kind: 'ServiceAccount'},
    // tslint:disable-next-line: max-line-length
    // { name: 'certificatesigningrequests', shortName: 'csr', api: 'certificates.k8s.io/v1', namespaced: false, kind: 'CertificateSigningRequest'},
    // { name: 'clusterroles', shortName: '', api: 'rbac.authorization.k8s.io/v1', namespaced: false, kind: 'ClusterRole'},
    // { name: 'clusterrolebindings', shortName: '', api: 'rbac.authorization.k8s.io/v1', namespaced: false, kind: 'ClusterRoleBinding'},
    // { name: 'roles', shortName: '', api: 'rbac.authorization.k8s.io/v1', namespaced: true , kind: 'Role'},
    // { name: 'rolebindings', shortName: '', api: 'rbac.authorization.k8s.io/v1', namespaced: true , kind: 'RoleBinding'},
    // { name: 'limitranges', shortName: 'limits', api: 'v1', namespaced: true , kind: 'LimitRange'},
    // { name: 'resourcequotas', shortName: 'quota', api: 'v1', namespaced: true , kind: 'ResourceQuota'},
    // { name: 'horizontalpodautoscalers', shortName: 'hpa', api: 'autoscaling/v1', namespaced: true , kind: 'HorizontalPodAutoscaler'},
    // tslint:disable-next-line: max-line-length
    // { name: 'customresourcedefinitions', shortName: 'crd,crds', api: 'apiextensions.k8s.io/v1', namespaced: false, kind: 'CustomResourceDefinition'},
    // { name: 'apiservices', shortName: '', api: 'apiregistration.k8s.io/v1', namespaced: false, kind: 'APIService'},
    // { name: 'bindings', shortName: '', api: 'v1', namespaced: true , kind: 'Binding'},
    // { name: 'componentstatuses', shortName: 'cs', api: 'v1', namespaced: false, kind: 'ComponentStatus'},
    // { name: 'controllerrevisions', shortName: '', api: 'apps/v1', namespaced: true , kind: 'ControllerRevision'},
    // { name: 'csidrivers', shortName: '', api: 'storage.k8s.io/v1', namespaced: false, kind: 'CSIDriver'},
    // { name: 'csinodes', shortName: '', api: 'storage.k8s.io/v1', namespaced: false, kind: 'CSINode'},
    // { name: 'csistoragecapacities', shortName: '', api: 'storage.k8s.io/v1beta1', namespaced: true , kind: 'CSIStorageCapacity'},
    // { name: 'flowschemas', shortName: '', api: 'flowcontrol.apiserver.k8s.io/v1beta1', namespaced: false, kind: 'FlowSchema'},
    // { name: 'leases', shortName: '', api: 'coordination.k8s.io/v1', namespaced: true , kind: 'Lease'},
    // tslint:disable-next-line: max-line-length
    // { name: 'localsubjectaccessreviews', shortName: '', api: 'authorization.k8s.io/v1', namespaced: true , kind: 'LocalSubjectAccessReview'},
    // tslint:disable-next-line: max-line-length
    // { name: 'mutatingwebhookconfigurations', shortName: '', api: 'admissionregistration.k8s.io/v1', namespaced: false, kind: 'MutatingWebhookConfiguration'},
    // { name: 'networkpolicies', shortName: 'netpol', api: 'networking.k8s.io/v1', namespaced: true , kind: 'NetworkPolicy'},
    // { name: 'poddisruptionbudgets', shortName: 'pdb', api: 'policy/v1', namespaced: true , kind: 'PodDisruptionBudget'},
    // { name: 'podsecuritypolicies', shortName: 'psp', api: 'policy/v1beta1', namespaced: false, kind: 'PodSecurityPolicy'},
    // { name: 'priorityclasses', shortName: 'pc', api: 'scheduling.k8s.io/v1', namespaced: false, kind: 'PriorityClass'},
    // tslint:disable-next-line: max-line-length
    // { name: 'prioritylevelconfigurations', shortName: '', api: 'flowcontrol.apiserver.k8s.io/v1beta1', namespaced: false, kind: 'PriorityLevelConfiguration'},
    // { name: 'runtimeclasses', shortName: '', api: 'node.k8s.io/v1', namespaced: false, kind: 'RuntimeClass'},
    // tslint:disable-next-line: max-line-length
    // { name: 'selfsubjectaccessreviews', shortName: '', api: 'authorization.k8s.io/v1', namespaced: false, kind: 'SelfSubjectAccessReview'},
    // { name: 'selfsubjectrulesreviews', shortName: '', api: 'authorization.k8s.io/v1', namespaced: false, kind: 'SelfSubjectRulesReview'},
    // { name: 'subjectaccessreviews', shortName: '', api: 'authorization.k8s.io/v1', namespaced: false, kind: 'SubjectAccessReview'},
    // { name: 'tokenreviews', shortName: '', api: 'authentication.k8s.io/v1', namespaced: false, kind: 'TokenReview'},
    // tslint:disable-next-line: max-line-length
    // { name: 'validatingwebhookconfigurations', shortName: '', api: 'admissionregistration.k8s.io/v1', namespaced: false, kind: 'ValidatingWebhookConfiguration'}
  ];
  public selectedResourceTypes: Array<ResourceType> = [];

  private resourceTypeWithIcon = {
    clusterroles: 'c-role',
    configmaps: 'cm',
    crb: 'crb',
    customresourcedefinitions: 'crd',
    cronjobs: 'cronjob',
    deployments: 'deploy',
    daemonsets: 'ds',
    endpoints: 'ep',
    group: 'group',
    helmreleases: 'helm',
    horizontalpodautoscalers: 'hpa',
    ingresses: 'ing',
    jobs: 'job',
    limitranges: 'limits',
    networkpolicies: 'netpol',
    namespaces: 'ns',
    nodes: 'node',
    pods: 'pod',
    psp: 'psp',
    persistentvolumes: 'pv',
    persistentvolumeclaims: 'pvc',
    resourcequotas: 'quota',
    rolebindings: 'rb',
    roles: 'role',
    replicasets: 'rs',
    serviceaccounts: 'sa',
    storageclasses: 'sc',
    secrets: 'secret',
    statefulsets: 'sts',
    services: 'svc',
    user: 'user',
    volumeattachments: 'vol',
  };

  public showFilters = false;

  public expandedRows = {};

  // tslint:disable-next-line: variable-name
  public _expandedResourceType: ResourceType;

  public resources: Resource[] = [];
  public selectedResource: Resource;

  public getOutput = '';
  public describeOutput = '';

  constructor(
    private translate: TranslateService,
    private appService: AppService,
    @Inject(DOCUMENT) private document: Document,
    private ngZone: NgZone) {
    this.translate.setDefaultLang('en');

    this.appService.messageFromExtension.subscribe((message: any) => {
      this.ngZone.run(() => {
        switch (message.command) {
          case 'initVersions':
            if (message.versions) {
              if(message.versions.clientVersion && message.versions.clientVersion.gitVersion) {
                this.clientVersion = message.versions.clientVersion.gitVersion;
              }
              if(message.versions.serverVersion && message.versions.serverVersion.gitVersion) {
                this.serverVersion = message.versions.serverVersion.gitVersion;
              }
            }
            break;
          case 'updateContexts':
            this.contexts = message.contexts;
            setTimeout(() => {
              const foundSelectedContext = this.contexts.find((context) => context.currentContext === true);
              if (foundSelectedContext) {
                this.selectedContext = foundSelectedContext;
              } else {
                this.selectedContext = this.UNKNOWN_CONTEXT;
              }
            }, 100);
            break;
          case 'updateNamespaces':
            this.namespaces = message.namespaces;
            setTimeout(() => {
              const foundSelectedNamespace = this.namespaces.find((namespace) => namespace.currentNamespace === true);
              if (foundSelectedNamespace) {
                this.selectedNamespace = foundSelectedNamespace;
              } else {
                this.selectedNamespace = this.UNKNOWN_NAMESPACE;
              }
              const storedShowFromNamespaces = localStorage.getItem('vscode-kubernetes-commander-editor.showFromNamespaces');
              if (storedShowFromNamespaces) {
                try {
                  const showFromNamespaces = [];
                  JSON.parse(storedShowFromNamespaces).forEach((namespace) => {
                    const foundNamespace = this.namespaces.find((n) => n.name === namespace.name);
                    if (foundNamespace) {
                      showFromNamespaces.push(foundNamespace);
                    }
                  });
                  if (showFromNamespaces.length > 0) {
                    this.showFromNamespaces = showFromNamespaces;
                  }
                } catch (e) {
                  this.showFromNamespaces = [this.selectedNamespace];
                }
              } else {
                // User selected different namespace, reset showFromNamespaces
                this.showFromNamespaces = [this.selectedNamespace];
              }
              if (!this.showFromNamespaces || this.showFromNamespaces.length === 0) {
                this.showFromNamespaces = [this.selectedNamespace];
              }
              localStorage.setItem('vscode-kubernetes-commander-editor.showFromNamespaces', JSON.stringify(this.showFromNamespaces));
            }, 500);
            break;
          case 'resourceTypes':
            this.resourceTypes = message.resourceTypes;
            break;
          case 'resources':
            this.resources = message.resources;
            break;
          case 'getResourceType':
            this.getOutput = message.getOutput;
            if (this.expandedResourceType &&
              this.expandedResourceType.name === message.resourceType.name &&
              this.expandedResourceType.autoRefresh) {
              setTimeout(() => {
                this.getResourceType(this.expandedResourceType);
              }, 10000);
            }
            break;
          case 'describeResourceType':
            this.describeOutput = message.describeOutput;
            break;
          case 'colorTheme':
            this.adjustTheme();
            break;
          case 'refreshView':
            break;
        }
      });
    });
  }

  ngOnInit(): void {
    // this.rt();
  }

  ngAfterViewInit(): void {
    this.adjustTheme();
  }

  get selectedNamespace() {
    return this._selectedNamespace;
  }

  set selectedNamespace(newSelectedNamespace: Namespace) {
    this._selectedNamespace = newSelectedNamespace;
    if (this._expandedResourceType) {
      this.getResources(this._expandedResourceType);
      this.getResourceType(this._expandedResourceType);
      this.describeResourceType(this._expandedResourceType);
    }
  }

  allNamespacesChanged() {
    if (this._expandedResourceType) {
      this.getResources(this._expandedResourceType);
      this.getResourceType(this._expandedResourceType);
      this.describeResourceType(this._expandedResourceType);
    }
  }

  showFromNamespacesChanged() {
    if (this._expandedResourceType) {
      if (this.showFromNamespacesDidChange) {
        this.showFromNamespacesDidChange = false;
        if (this.showFromNamespaces.length === 0) {
          this.showFromNamespaces = [this.selectedNamespace];
        }
        localStorage.setItem('vscode-kubernetes-commander-editor.showFromNamespaces', JSON.stringify(this.showFromNamespaces));
        this.getResources(this._expandedResourceType);
        this.getResourceType(this._expandedResourceType);
        this.describeResourceType(this._expandedResourceType);
      }
    }
  }

  autoRefreshChanged() {
    if (this._expandedResourceType) {
      this.getResources(this._expandedResourceType);
      this.getResourceType(this._expandedResourceType);
    }
  }

  get expandedResourceType() {
    return this._expandedResourceType;
  }

  set expandedResourceType(ert) {
    this._expandedResourceType = ert;
    if (ert) {
      this.getResources(this._expandedResourceType);
      this.getResourceType(this._expandedResourceType);
      this.describeResourceType(this._expandedResourceType);
    }
  }

  rowExpanded(event) {
    this.expandedResourceType = event.data;
  }

  rowCollapsed(event) {
    this.expandedResourceType = undefined;
    this.resources = [];
    this.selectedResource = undefined;
    this.getOutput = '';
    this.describeOutput = '';
  }

  switchNamespace(event) {
    this.appService.switchNamespace(event.value);
  }

  getResources(resourceType: ResourceType) {
    this.appService.getResources(resourceType, this.allNamespaces, this.showFromNamespaces);
  }

  getResourceType(resourceType: ResourceType) {
    this.appService.getResourceType(resourceType, this.allNamespaces, this.showFromNamespaces);
  }

  describeResourceType(resourceType: ResourceType) {
    this.appService.describeResourceType(resourceType, this.allNamespaces, this.showFromNamespaces);
  }

  loadResource(resourceType: ResourceType, resource: Resource) {
    this.appService.loadResource(resourceType, resource);
  }

  describeResource(resourceType: ResourceType, resource: Resource) {
    this.appService.describeResource(resourceType, resource);
  }

  deleteResourceType(resourceType: ResourceType, namespace: Namespace, allNamespaces: boolean) {
    this.appService.deleteResourceType(resourceType, namespace.name, allNamespaces);
  }

  deleteResource(resourceType: ResourceType, resource: Resource) {
    this.appService.deleteResource(resourceType, resource);
  }

  documentation(resourceType: ResourceType) {
    this.appService.documentation(resourceType.name);
  }

  adjustTheme() {
    let theme = 'light-theme';
    if (document.body.classList.contains('vscode-light')) {
      theme = 'light-theme';
    } else if (document.body.classList.contains('vscode-dark')) {
      theme = 'dark-theme';
    }
    const themeLink = this.document.getElementById('app-theme') as HTMLLinkElement;
    if (themeLink) {
        themeLink.href = theme + '.css';
    }
  }

  editKubeconfig() {
    this.appService.editKubeconfig(this.kubeconfig);
  }

  editKubeconfigs() {
    this.appService.editKubeconfigs();
  }

  compareSelectedRevisions(resourceType: ResourceType, resource: Resource) {
    if (resourceType.name === 'helmreleases') {
      this.appService.compareSelectedReleaseRevisions(
        resource.namespace,
        resource.name,
        resource.selectedRevision0,
        resource.namespace,
        resource.name,
        resource.selectedRevision,
      );
    }
  }

  compareSelectedReleaseRevisions(resourceType: ResourceType, resources: Resource[]) {
    if (resourceType.name === 'helmreleases') {
      const selectedResources: Resource[] = [];
      resources.forEach((resource) => {
        if (resource.selectedForCompare) {
          selectedResources.push(resource);
        }
      });
      if (selectedResources.length === 2) {
        this.appService.compareSelectedReleaseRevisions(
          selectedResources[0].namespace,
          selectedResources[0].name,
          selectedResources[0].selectedRevision,
          selectedResources[1].namespace,
          selectedResources[1].name,
          selectedResources[1].selectedRevision,
        );
      } else {
        this.appService.showErrorMessage(`Must select two items to compare`)
      }
    }
  }

  resourceIconPath(resourceType: ResourceType): string {
    if (Object.keys(this.resourceTypeWithIcon).includes(resourceType.name)) {
      return `assets/icons/${this.resourceTypeWithIcon[resourceType.name]}-128.png`;
    } else {
      return `assets/icons/k8s-128.png`;
    }
  }
}
