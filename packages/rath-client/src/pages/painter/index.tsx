import { IFieldMeta, IRow, ISemanticType } from '@kanaries/loa';
import { observer } from 'mobx-react-lite';
import styled from 'styled-components';
import { IMutField } from '@kanaries/graphic-walker/dist/interfaces';
import { Specification } from 'visual-insights';
import { DefaultButton, PrimaryButton, Slider, Toggle, Stack, SwatchColorPicker } from '@fluentui/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import embed, { vega } from 'vega-embed';
import { Item, ScenegraphEvent } from 'vega';
import ReactVega from '../../components/react-vega';
import { IVegaSubset } from '../../interfaces';
import { useGlobalStore } from '../../store';
import { deepcopy, getRange } from '../../utils';
import { transVegaSubset2Schema } from '../../utils/transform';
import { batchMutInCatRange, batchMutInCircle, nnMic } from './utils';
import EmbedAnalysis from './embedAnalysis';


const Cont = styled.div`
    /* cursor: none !important; */
`;

const PainterContainer = styled.div`
    display: flex;
    .vis-segment {
        flex-grow: 1;
    }
    .operation-segment {
        flex-grow: 0;
        flex-shrink: 0;
        min-width: 200px;
    }
`;

const COLOR_SCHEME: string[] = [];
const RAW = '4c78a8f58518e4575672b7b254a24beeca3bb279a2ff9da69d755dbab0ac';
for (let i = 0; i < RAW.length; i += 6) {
    COLOR_SCHEME.push('#' + RAW.slice(i, i + 6));
}

const colorCells = COLOR_SCHEME.map((c, i) => ({
    id: `L_${i + 1}`,
    color: c,
    label: `L_${i + 1}`,
}));

const LABEL_FIELD_KEY = '_lab_field';
const LABEL_INDEX = '_label_index';

const Painter: React.FC = (props) => {
    const container = useRef<HTMLDivElement>(null);
    const { dataSourceStore, commonStore } = useGlobalStore();
    const { cleanedData, fieldMetas } = dataSourceStore;
    const { vizSpec } = commonStore;
    const [mutData, setMutData] = useState<IRow[]>([]);
    const [nearFields, setNearFields] = useState<IFieldMeta[]>([]);
    const [nearIndex, setNearIndex] = useState<number>(0);
    const [mutFeatValues, setMutFeatValues] = useState<string[]>(colorCells.map((c) => c.id));
    const [mutFeatIndex, setMutFeatIndex] = useState<number>(1);
    const [painting, setPainting] = useState<boolean>(false);
    const [painterSize, setPainterSize] = useState<number>(0.1);
    const [showWalker, setShowWalker] = useState<boolean>(false);

    const initValue = mutFeatValues[0];

    const clearPainting = useCallback(() => {
        setMutData(
            cleanedData.map((r, i) => {
                return { ...r, [LABEL_FIELD_KEY]: initValue, [LABEL_INDEX]: i };
            })
        );
    }, [cleanedData, initValue]);

    useEffect(() => {
        setMutData(
            cleanedData.map((r, i) => {
                return { ...r, [LABEL_FIELD_KEY]: initValue, [LABEL_INDEX]: i };
            })
        );
    }, [cleanedData, fieldMetas, initValue]);

    const getNearFields = useCallback(
        (data: IRow[]) => {
            const X = data.map((r) => r[LABEL_FIELD_KEY]);
            const ans: { field: IFieldMeta; score: number }[] = [];
            for (let field of fieldMetas) {
                // eslint-disable-next-line no-constant-condition
                if (true) {
                    const Y = data.map((r) => r[field.fid]);
                    const score = nnMic(X, Y);
                    ans.push({
                        field,
                        score,
                    });
                }
            }
            ans.sort((a, b) => b.score - a.score);
            setNearFields(ans.map((a) => a.field));
        },
        [fieldMetas]
    );

    const noViz = mutData.length === 0 || fieldMetas.length === 0 || vizSpec === null;
    useEffect(() => {
        if (!noViz && container.current) {
            const mvd: any = {
                ...deepcopy(vizSpec),
                data: {
                    name: 'dataSource',
                    // values: mutData
                },
            };
            mvd.encoding.color = {
                field: LABEL_FIELD_KEY,
                type: 'nominal',
                title: 'custom feature',
                scale: {
                    domain: mutFeatValues,
                },
            };

            // @ts-ignore
            embed(container.current, mvd, {
                actions: true,
            }).then((res) => {
                res.view.change(
                    'dataSource',
                    vega
                        .changeset()
                        .remove(() => true)
                        .insert(mutData)
                );
                const xField = mvd.encoding.x.field;
                const yField = mvd.encoding.y.field;
                const xFieldType = mvd.encoding.x.type as ISemanticType;
                const yFieldType = mvd.encoding.y.type as ISemanticType;
                if (xFieldType === 'quantitative' && yFieldType === 'quantitative') {
                    const xRange = getRange(mutData.map((r) => r[xField]));
                    const yRange = getRange(mutData.map((r) => r[yField]));
                    const hdr = (e: ScenegraphEvent, item: Item<any> | null | undefined) => {
                        if (painting && item && item.datum) {
                            const { mutIndices, mutValues } = batchMutInCircle({
                                mutData,
                                fields: [xField, yField],
                                point: [item.datum[xField], item.datum[yField]],
                                a: xRange[1] - xRange[0],
                                b: yRange[1] - yRange[0],
                                r: painterSize,
                                key: LABEL_FIELD_KEY,
                                indexKey: LABEL_INDEX,
                                value: mutFeatValues[mutFeatIndex],
                            });
                            res.view.change(
                                'dataSource',
                                vega
                                    .changeset()
                                    .remove((r: any) => mutIndices.has(r[LABEL_INDEX]))
                                    .insert(mutValues)
                            );
                            res.view.runAsync();
                        }
                    }
                    res.view.addEventListener('mouseover', hdr);
                    res.view.addEventListener('touchmove', hdr);
                } else if (xFieldType !== 'quantitative' && yFieldType === 'quantitative') {
                    const yRange = getRange(mutData.map((r) => r[yField]));
                    const hdr = (e: ScenegraphEvent, item: Item<any> | null | undefined) => {
                        if (painting && item && item.datum) {
                            const { mutIndices, mutValues } = batchMutInCatRange({
                                mutData,
                                fields: [xField, yField],
                                point: [item.datum[xField], item.datum[yField]],
                                r: painterSize,
                                key: LABEL_FIELD_KEY,
                                range: yRange[1] - yRange[0],
                                indexKey: LABEL_INDEX,
                                value: mutFeatValues[mutFeatIndex],
                            });
                            res.view.change(
                                'dataSource',
                                vega
                                    .changeset()
                                    .remove((r: any) => mutIndices.has(r[LABEL_INDEX]))
                                    .insert(mutValues)
                            );
                        }
                    }
                    res.view.addEventListener('mouseover', hdr);
                    res.view.addEventListener('touchmove', hdr);
                } else if (yFieldType !== 'quantitative' && xFieldType === 'quantitative') {
                    const hdr = (e: ScenegraphEvent, item: Item<any> | null | undefined) => {
                        if (painting && item && item.datum) {
                            const xRange = getRange(mutData.map((r) => r[xField]));
                            const { mutIndices, mutValues } = batchMutInCatRange({
                                mutData,
                                fields: [yField, xField],
                                point: [item.datum[yField], item.datum[xField]],
                                r: painterSize,
                                range: xRange[1] - xRange[0],
                                key: LABEL_FIELD_KEY,
                                indexKey: LABEL_INDEX,
                                value: mutFeatValues[mutFeatIndex],
                            });
                            res.view.change(
                                'dataSource',
                                vega
                                    .changeset()
                                    .remove((r: any) => mutIndices.has(r[LABEL_INDEX]))
                                    .insert(mutValues)
                            );
                        }
                    }
                    res.view.addEventListener('mouseover', hdr);
                    res.view.addEventListener('touchmove', hdr);
                }
                res.view.resize();
                res.view.run();
            });
        }
    }, [noViz, vizSpec, mutData, mutFeatValues, mutFeatIndex, painting, painterSize]);

    const nearSpec = useMemo<IVegaSubset | null>(() => {
        if (nearFields.length > 0) {
            const mvd: any = {
                ...deepcopy(vizSpec),
                data: {
                    name: 'dataSource',
                    // values: mutData
                },
            };
            mvd.encoding.color = {
                field: nearFields[nearIndex].fid,
                type: nearFields[nearIndex].semanticType,
                title: nearFields[nearIndex].name || nearFields[nearIndex].fid,
            };
            return mvd;
        }
        return null;
    }, [vizSpec, nearFields, nearIndex]);

    const fieldsInWalker = useMemo<IMutField[]>(() => {
        return fieldMetas.map(f => ({
            fid: f.fid,
            name: f.name,
            semanticType: f.semanticType,
            analyticType: f.analyticType
        })).concat({
            fid: LABEL_FIELD_KEY,
            name: 'new field',
            semanticType: 'nominal',
            analyticType: 'dimension'
        })
    }, [fieldMetas])

    const walkerSchema = useMemo<Specification>(() => {
        if (nearSpec) {
            return transVegaSubset2Schema(nearSpec)
        }
        return {}
    }, [nearSpec])

    if (noViz) {
        return <div>404</div>;
    }
    return (
        <Cont style={{ padding: '1em' }}>
            <div className="cursor rounded"></div>
            <div className="card">
                <PainterContainer>
                    <div className="vis-segment">
                        <div ref={container}></div>
                    </div>
                    <div className="operation-segment">
                        <Stack tokens={{ childrenGap: 18 }}>
                            <Stack.Item>
                                <Toggle
                                    label="Painting"
                                    checked={painting}
                                    onChange={(e, checked) => {
                                        setPainting(Boolean(checked));
                                    }}
                                />
                            </Stack.Item>
                            <Stack.Item>
                                <SwatchColorPicker
                                    selectedId={mutFeatValues[mutFeatIndex]}
                                    columnCount={5}
                                    cellShape={'circle'}
                                    colorCells={colorCells}
                                    onColorChanged={(id) => {
                                        if (id) {
                                            const targetIndex = colorCells.findIndex((f) => f.id === id);
                                            targetIndex > -1 && setMutFeatIndex(targetIndex);
                                        }
                                    }}
                                />
                            </Stack.Item>
                            <Stack.Item>
                                <Slider
                                    min={0.01}
                                    max={1}
                                    step={0.01}
                                    value={painterSize}
                                    label="Painter Size"
                                    onChange={(s, v) => {
                                        setPainterSize(s);
                                    }}
                                />
                            </Stack.Item>
                            <Stack.Item>
                                <DefaultButton
                                    disabled
                                    text="Add label"
                                    onClick={() => {
                                        setMutFeatValues((v) => [...v, `Label ${v.length + 1}`]);
                                    }}
                                />
                            </Stack.Item>
                        </Stack>
                    </div>
                </PainterContainer>
                <div>
                    <Stack horizontal tokens={{ childrenGap: 10 }}>
                        <PrimaryButton
                            text="Search"
                            iconProps={{ iconName: 'Search' }}
                            onClick={() => {
                                getNearFields(mutData);
                            }}
                        />
                        <PrimaryButton
                            text='Explore'
                            iconProps={{ iconName: 'BarChartVerticalEdit' }}
                            onClick={() => {
                                getNearFields(mutData);
                                setShowWalker(true)
                            }}
                        />
                        <DefaultButton
                            iconProps={{ iconName: 'Trash' }}
                            text="Clear Painting"
                            onClick={clearPainting}
                        />
                    </Stack>
                </div>
            </div>
            {
                !showWalker && <div className="card">
                    <Stack horizontal tokens={{ childrenGap: 10 }}>
                        <DefaultButton
                            text="Last"
                            iconProps={{ iconName: 'Back' }}
                            onClick={() => {
                                setNearIndex((v) => (v - 1 + nearFields.length) % nearFields.length);
                            }}
                        />
                        <DefaultButton
                            text="Next"
                            iconProps={{ iconName: 'Forward' }}
                            onClick={() => {
                                setNearIndex((v) => (v + 1) % nearFields.length);
                            }}
                        />
                    </Stack>
                    {nearSpec && <ReactVega spec={nearSpec} dataSource={cleanedData} />}
                </div>
            }
            {
                showWalker && nearSpec && <EmbedAnalysis
                    dataSource={mutData}
                    spec={walkerSchema}
                    fields={fieldsInWalker}
                />
            }
        </Cont>
    );
};

export default observer(Painter);
