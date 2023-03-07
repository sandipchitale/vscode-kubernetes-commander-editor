import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AppService {
  vscode: any;

  // tslint:disable-next-line: variable-name
  _message = new Subject();

  constructor() {
    // tslint:disable-next-line: no-string-literal
    this.vscode = window['acquireVsCodeApi']();
    window.addEventListener('message', event => {
      const message = event.data; // The JSON data our extension sent
      this._message.next(message);
    });
  }

  get messageFromExtension() {
    return this._message.asObservable();
  }

  editKubeconfig(kubeconfig: string) {
    this.vscode.postMessage({
      command: 'editKubeconfig',
      kubeconfig
    });
  }

  editKubeconfigs() {
    this.vscode.postMessage({
      command: 'editKubeconfigs'
    });
  }

  switchNamespace(namespace: string) {
    this.vscode.postMessage({
      command: 'switchNamespace',
      namespace
    });
  }

  getResources(resourceType, allNamespaces: boolean, showFromNamespaces: any[]) {
    this.vscode.postMessage({
      command: 'resources',
      resourceType,
      allNamespaces,
      showFromNamespaces
    });
  }

  getResourceType(resourceType, allNamespaces: boolean, showFromNamespaces: any[]) {
    this.vscode.postMessage({
      command: 'get',
      resourceType,
      allNamespaces,
      showFromNamespaces
    });
  }

  describeResourceType(resourceType, allNamespaces: boolean, showFromNamespaces: any[]) {
    this.vscode.postMessage({
      command: 'describe',
      resourceType,
      allNamespaces,
      showFromNamespaces
    });
  }

  describeResource(resourceType: any, resource: any) {
    this.vscode.postMessage({
      command: 'describeResource',
      resourceType,
      resource
    });
  }

  loadResource(resourceType: any, resource: any) {
    this.vscode.postMessage({
      command: 'loadResource',
      resourceType,
      resource
    });
  }

  deleteResourceType(resourceType, namespace: string, allNamespaces: boolean) {
    this.vscode.postMessage({
      command: 'deleteResourceType',
      resourceType,
      namespace,
      allNamespaces
    });
  }

  deleteResource(resourceType: any, resource: any) {
    this.vscode.postMessage({
      command: 'deleteResource',
      resourceType,
      resource
    });
  }

  documentation(resourceTypeName: string) {
    this.vscode.postMessage({
      command: 'documentation',
      resourceTypeName
    });
  }


  compareSelectedReleaseRevisions(
    namespace1: string,
    release1: string,
    revision1: number,
    namespace2: string,
    release2: string,
    revision2: number,
  ) {
    this.vscode.postMessage({
      command: 'compareSelectedReleaseRevisions',
      namespace1,
      release1,
      revision1,
      namespace2,
      release2,
      revision2,
    });
  }

  showErrorMessage(message: string) {
    this.vscode.postMessage({
      command: 'showErrorMessage',
      message
    });
  }
}
