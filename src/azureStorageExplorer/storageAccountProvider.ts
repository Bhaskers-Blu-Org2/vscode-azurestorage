/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line:no-require-imports
import { StorageManagementClient } from 'azure-arm-storage';
import { StorageAccount } from 'azure-arm-storage/lib/models';
import * as vscode from 'vscode';
import { AzureTreeItem, AzureWizard, createAzureClient, createTreeItemsWithErrorHandling, IActionContext, IStorageAccountWizardContext, ISubscriptionRoot, LocationListStep, ResourceGroupListStep, StorageAccountCreateStep, StorageAccountKind, StorageAccountNameStep, StorageAccountPerformance, StorageAccountReplication, SubscriptionTreeItem } from 'vscode-azureextensionui';
import { nonNull, StorageAccountWrapper } from '../components/storageWrappers';
import { StorageAccountTreeItem } from './storageAccounts/storageAccountNode';

export class StorageAccountProvider extends SubscriptionTreeItem {
    public childTypeLabel: string = "Storage Account";

    async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzureTreeItem[]> {
        let storageManagementClient = createAzureClient(this.root, StorageManagementClient);

        let accounts = await storageManagementClient.storageAccounts.list();
        return createTreeItemsWithErrorHandling(
            this,
            accounts,
            'invalidStorageAccount',
            async (sa: StorageAccount) => await StorageAccountTreeItem.createStorageAccountTreeItem(this, new StorageAccountWrapper(sa), storageManagementClient),
            (sa: StorageAccount) => {
                return sa.name;
            }
        );
    }

    public async createChildImpl(showCreatingTreeItem: (label: string) => void, _userOptions: Object, actionContext?: IActionContext): Promise<AzureTreeItem<ISubscriptionRoot>> {
        let storageManagementClient = createAzureClient(this.root, StorageManagementClient);
        const wizardContext: IStorageAccountWizardContext = Object.assign({}, this.root);

        const wizard = new AzureWizard(
            [new StorageAccountNameStep(), new ResourceGroupListStep(), new LocationListStep()],
            [new StorageAccountCreateStep({ kind: StorageAccountKind.StorageV2, performance: StorageAccountPerformance.Standard, replication: StorageAccountReplication.LRS })],
            wizardContext);

        // https://github.com/Microsoft/vscode-azuretools/issues/120
        actionContext = actionContext ? actionContext : <IActionContext>{ properties: {}, measurements: {} };

        await wizard.prompt(actionContext);

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (progress) => {
            showCreatingTreeItem(nonNull(wizardContext.newStorageAccountName));
            progress.report({ message: `Creating storage account '${wizardContext.newStorageAccountName}'` });
            await wizard.execute(nonNull(actionContext));
        });
        return await StorageAccountTreeItem.createStorageAccountTreeItem(this, new StorageAccountWrapper(nonNull(wizardContext.storageAccount)), storageManagementClient);
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }
}
