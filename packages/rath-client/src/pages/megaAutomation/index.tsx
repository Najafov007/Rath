import React, { useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { Divider } from '@material-ui/core';
import styled from 'styled-components';
import intl from 'react-intl-universal';
import { runInAction } from 'mobx';
import { DefaultButton, PrimaryButton, Spinner } from '@fluentui/react';
import { useGlobalStore } from '../../store';
import VisErrorBoundary from '../../visBuilder/visErrorBoundary';
import { IResizeMode } from '../../interfaces';
import { LoadingLayer } from '../semiAutomation/components';
import ReactVega from '../../components/react-vega';
import { PIVOT_KEYS } from '../../constants';
import VizPreference from './preference';
import SaveModal from './save';
import OperationBar from './vizOperation/operationBar';
import FieldContainer from './vizOperation/fieldContainer';
import ResizeContainer from './resizeContainer';
import Narrative from './narrative';
import ComputationProgress from './computationProgress';
import Constraints from './vizOperation/constraints';
import AssoPanel from './assoPanel';
import VizPagination from './vizPagination';

const MainHeader = styled.div`
    font-size: 1.5em;
    font-weight: 500;
`;

const InsightContainer = styled.div`
    .ope-container {
        margin: 1em 0em;
        padding-bottom: 1em;
        border-bottom: 1px solid #f5f5f5;
    }
    .flex-container {
        display: flex;
        overflow-x: auto;
        .spec-container {
            flex-grow: 0;
            flex-shrink: 0;
            overflow-y: auto;
        }
        .insight-viz {
            position: relative;
            padding: 2em;
            flex-grow: 0;
            flex-shrink: 0;
            /* flex-basis: 400px; */
            /* min-width: 500px; */
            /* flex-shrink: 2; */
            overflow: auto;
        }
        .insight-info {
            flex-grow: 1;
            flex-shrink: 1;
            flex-wrap: wrap;
            padding: 0em 1em;
            border-left: 1px solid #f5f5f5;
            overflow: auto;
        }
    }
`;

const LTSPage: React.FC = () => {
    const { ltsPipeLineStore, megaAutoStore, commonStore } = useGlobalStore();
    const { rendering, dataSource } = ltsPipeLineStore;

    const { visualConfig, mainViewSpec } = megaAutoStore;
    const { taskMode } = commonStore;

    // const [subinsightsData, setSubinsightsData] = useState<any[]>([]);

    // const downloadResults = useCallback(() => {
    //     megaAutoStore.downloadResults();
    // }, [megaAutoStore])

    // const dataIsEmpty = ltsPipeLineStore.dataSource.length === 0;

    // const getSubinsights = useCallback((dimensions: string[], measures: string[]) => {
    //     megaAutoStore.getSubInsights(dimensions, measures).then(res => {
    //         setSubinsightsData(res)
    //         megaAutoStore.setShowSubinsights(true)
    //     })
    // }, [megaAutoStore])
    const startTask = useCallback(() => {
        ltsPipeLineStore.startTask(taskMode).then(() => {
            megaAutoStore.emitViewChangeTransaction(0);
        });
        commonStore.setAppKey(PIVOT_KEYS.lts);
    }, [ltsPipeLineStore, megaAutoStore, commonStore, taskMode]);
    return (
        <div className="content-container">
            <VizPreference />
            <SaveModal />
            <Constraints />
            <AssoPanel />
            {/* <div className="card">
                <Gallery />
            </div> */}
            {/* <SubinsightSegment data={subinsightsData} show={showSubinsights} onClose={() => { megaAutoStore.setShowSubinsights(false) }} /> */}
            <div className="card">
                <DefaultButton
                    style={{ float: 'right' }}
                    iconProps={{ iconName: 'Settings' }}
                    text={intl.get('explore.preference')}
                    ariaLabel={intl.get('explore.preference')}
                    onClick={() => {
                        runInAction(() => {
                            megaAutoStore.showPreferencePannel = true;
                        });
                    }}
                />
                <PrimaryButton
                    style={{ float: 'right', marginRight: '1em' }}
                    iconProps={{ iconName: 'Rerun' }}
                    text={intl.get('lts.reRun')}
                    ariaLabel={intl.get('lts.reRun')}
                    onClick={startTask}
                />
                <ComputationProgress />
                <MainHeader>{intl.get('lts.title')}</MainHeader>
                <p className="state-description">{intl.get('lts.hintMain')}</p>
                <Divider style={{ marginBottom: '1em', marginTop: '1em' }} />
                <VizPagination />
                <Divider style={{ marginBottom: '1em', marginTop: '1em' }} />
                <InsightContainer>
                    <div className="ope-container">
                        <OperationBar />
                    </div>
                    <div className="flex-container">
                        {/* <div className='spec-container'>
                        {
                            spec && <VizSpec
                                schema={spec.schema}
                                fields={fieldMetas}
                                onSchemaChange={(schemaKey, pos, val) => {
                                    megaAutoStore.setSpecSchema(schemaKey, pos, val);
                                }}
                            />
                        }
                    </div> */}
                        <div className="insight-viz">
                            {rendering && (
                                <LoadingLayer>
                                    <Spinner label="Rendering..." />
                                </LoadingLayer>
                            )}
                            {mainViewSpec && (
                                <ResizeContainer
                                    enableResize={
                                        visualConfig.resize === IResizeMode.control &&
                                        !(mainViewSpec.encoding.column || mainViewSpec.encoding.row)
                                    }
                                >
                                    <VisErrorBoundary>
                                        <ReactVega
                                            dataSource={dataSource}
                                            spec={mainViewSpec}
                                            actions={visualConfig.debug}
                                        />
                                    </VisErrorBoundary>
                                </ResizeContainer>
                            )}
                        </div>
                        <div className="insight-info">{visualConfig.nlg && <Narrative />}</div>
                    </div>
                    <div>
                        <FieldContainer />
                    </div>
                </InsightContainer>
            </div>
        </div>
    );
};

export default observer(LTSPage);
